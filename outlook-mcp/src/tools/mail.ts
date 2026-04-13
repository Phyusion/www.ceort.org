import { z } from "zod";
import {
  defineTool,
  BodyTypeSchema,
  EmailAddressSchema,
  toBody,
  toRecipients,
  type ToolDefinition,
} from "./shared.js";

const MessageListSelect =
  "id,conversationId,subject,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,bodyPreview,hasAttachments,isRead,importance,webLink";

export const mailTools: ToolDefinition[] = [
  defineTool({
    name: "outlook_list_mail_folders",
    description:
      "List Outlook mail folders (Inbox, Sent Items, custom folders). Returns id, displayName, unreadItemCount and totalItemCount.",
    inputSchema: z.object({
      top: z.number().int().min(1).max(200).default(50),
    }),
    async handler({ top }, { graph, scope }) {
      const res = await graph
        .api(`${scope}/mailFolders`)
        .top(top)
        .select("id,displayName,unreadItemCount,totalItemCount,parentFolderId")
        .get();
      return res.value;
    },
  }),

  defineTool({
    name: "outlook_list_messages",
    description:
      "List messages in a mail folder (defaults to Inbox). Supports OData filter/orderby and pagination. Use this for browsing a folder; use outlook_search_messages for full-text search.",
    inputSchema: z.object({
      folderId: z
        .string()
        .default("inbox")
        .describe(
          "Mail folder id or well-known name (inbox, sentitems, drafts, deleteditems, junkemail, archive, outbox).",
        ),
      top: z.number().int().min(1).max(100).default(25),
      skip: z.number().int().min(0).default(0),
      filter: z
        .string()
        .optional()
        .describe("OData $filter, e.g. \"isRead eq false and importance eq 'high'\""),
      orderby: z.string().default("receivedDateTime desc"),
    }),
    async handler({ folderId, top, skip, filter, orderby }, { graph, scope }) {
      let req = graph
        .api(`${scope}/mailFolders/${folderId}/messages`)
        .top(top)
        .skip(skip)
        .orderby(orderby)
        .select(MessageListSelect);
      if (filter) req = req.filter(filter);
      const res = await req.get();
      return res.value;
    },
  }),

  defineTool({
    name: "outlook_search_messages",
    description:
      "Full-text search across the mailbox using Graph $search (KQL). Example query: 'from:alice@example.com subject:invoice'.",
    inputSchema: z.object({
      query: z.string().min(1),
      top: z.number().int().min(1).max(100).default(25),
    }),
    async handler({ query, top }, { graph, scope }) {
      const res = await graph
        .api(`${scope}/messages`)
        .top(top)
        .search(`"${query.replace(/"/g, '\\"')}"`)
        .select(MessageListSelect)
        .get();
      return res.value;
    },
  }),

  defineTool({
    name: "outlook_get_message",
    description: "Fetch a full message including its body and attachment metadata.",
    inputSchema: z.object({
      messageId: z.string(),
      includeAttachments: z.boolean().default(false),
      bodyFormat: z.enum(["text", "html"]).default("text"),
    }),
    async handler({ messageId, includeAttachments, bodyFormat }, { graph, scope }) {
      const message = await graph
        .api(`${scope}/messages/${messageId}`)
        .header("Prefer", `outlook.body-content-type="${bodyFormat}"`)
        .get();
      if (includeAttachments) {
        const attachments = await graph
          .api(`${scope}/messages/${messageId}/attachments`)
          .select("id,name,contentType,size,isInline")
          .get();
        message.attachments = attachments.value;
      }
      return message;
    },
  }),

  defineTool({
    name: "outlook_send_message",
    description:
      "Compose and send a new email. Set saveToSentItems=false to suppress saving a copy. Use bodyType='html' for formatted messages.",
    inputSchema: z.object({
      to: z.array(EmailAddressSchema).min(1),
      cc: z.array(EmailAddressSchema).optional(),
      bcc: z.array(EmailAddressSchema).optional(),
      subject: z.string(),
      body: z.string(),
      bodyType: BodyTypeSchema,
      importance: z.enum(["low", "normal", "high"]).default("normal"),
      saveToSentItems: z.boolean().default(true),
    }),
    async handler(args, { graph, scope }) {
      const payload = {
        message: {
          subject: args.subject,
          body: toBody(args.body, args.bodyType),
          toRecipients: toRecipients(args.to),
          ccRecipients: toRecipients(args.cc),
          bccRecipients: toRecipients(args.bcc),
          importance: args.importance,
        },
        saveToSentItems: args.saveToSentItems,
      };
      await graph.api(`${scope}/sendMail`).post(payload);
      return { ok: true };
    },
  }),

  defineTool({
    name: "outlook_create_draft",
    description: "Create a draft email (does not send). Returns the draft id so it can be updated or sent later.",
    inputSchema: z.object({
      to: z.array(EmailAddressSchema).optional(),
      cc: z.array(EmailAddressSchema).optional(),
      bcc: z.array(EmailAddressSchema).optional(),
      subject: z.string(),
      body: z.string(),
      bodyType: BodyTypeSchema,
    }),
    async handler(args, { graph, scope }) {
      return graph.api(`${scope}/messages`).post({
        subject: args.subject,
        body: toBody(args.body, args.bodyType),
        toRecipients: toRecipients(args.to),
        ccRecipients: toRecipients(args.cc),
        bccRecipients: toRecipients(args.bcc),
      });
    },
  }),

  defineTool({
    name: "outlook_send_draft",
    description: "Send a previously-created draft by id.",
    inputSchema: z.object({ messageId: z.string() }),
    async handler({ messageId }, { graph, scope }) {
      await graph.api(`${scope}/messages/${messageId}/send`).post({});
      return { ok: true };
    },
  }),

  defineTool({
    name: "outlook_reply_message",
    description:
      "Reply to an existing message. Use replyAll=true to reply-all. The comment is added above the quoted original.",
    inputSchema: z.object({
      messageId: z.string(),
      comment: z.string(),
      replyAll: z.boolean().default(false),
    }),
    async handler({ messageId, comment, replyAll }, { graph, scope }) {
      const endpoint = replyAll ? "replyAll" : "reply";
      await graph.api(`${scope}/messages/${messageId}/${endpoint}`).post({ comment });
      return { ok: true };
    },
  }),

  defineTool({
    name: "outlook_forward_message",
    description: "Forward an existing message to new recipients with an optional comment.",
    inputSchema: z.object({
      messageId: z.string(),
      to: z.array(EmailAddressSchema).min(1),
      comment: z.string().default(""),
    }),
    async handler({ messageId, to, comment }, { graph, scope }) {
      await graph.api(`${scope}/messages/${messageId}/forward`).post({
        toRecipients: toRecipients(to),
        comment,
      });
      return { ok: true };
    },
  }),

  defineTool({
    name: "outlook_update_message",
    description:
      "Update mutable fields on a message (mark read/unread, flag, change importance, change categories).",
    inputSchema: z.object({
      messageId: z.string(),
      isRead: z.boolean().optional(),
      importance: z.enum(["low", "normal", "high"]).optional(),
      categories: z.array(z.string()).optional(),
      flag: z.enum(["notFlagged", "flagged", "complete"]).optional(),
    }),
    async handler({ messageId, isRead, importance, categories, flag }, { graph, scope }) {
      const patch: Record<string, unknown> = {};
      if (isRead !== undefined) patch.isRead = isRead;
      if (importance !== undefined) patch.importance = importance;
      if (categories !== undefined) patch.categories = categories;
      if (flag !== undefined) patch.flag = { flagStatus: flag };
      return graph.api(`${scope}/messages/${messageId}`).patch(patch);
    },
  }),

  defineTool({
    name: "outlook_move_message",
    description:
      "Move a message to another folder. destinationId accepts well-known names (e.g. 'archive', 'deleteditems').",
    inputSchema: z.object({
      messageId: z.string(),
      destinationId: z.string(),
    }),
    async handler({ messageId, destinationId }, { graph, scope }) {
      return graph
        .api(`${scope}/messages/${messageId}/move`)
        .post({ destinationId });
    },
  }),

  defineTool({
    name: "outlook_delete_message",
    description:
      "Delete a message. By default it's moved to Deleted Items; set permanent=true to hard-delete.",
    inputSchema: z.object({
      messageId: z.string(),
      permanent: z.boolean().default(false),
    }),
    async handler({ messageId, permanent }, { graph, scope }) {
      if (permanent) {
        await graph.api(`${scope}/messages/${messageId}`).delete();
      } else {
        await graph
          .api(`${scope}/messages/${messageId}/move`)
          .post({ destinationId: "deleteditems" });
      }
      return { ok: true };
    },
  }),

  defineTool({
    name: "outlook_download_attachment",
    description:
      "Download a file attachment from a message. Returns base64-encoded content along with contentType and name.",
    inputSchema: z.object({
      messageId: z.string(),
      attachmentId: z.string(),
    }),
    async handler({ messageId, attachmentId }, { graph, scope }) {
      const attachment = await graph
        .api(`${scope}/messages/${messageId}/attachments/${attachmentId}`)
        .get();
      return {
        name: attachment.name,
        contentType: attachment.contentType,
        size: attachment.size,
        contentBytes: attachment.contentBytes, // base64 for fileAttachment
      };
    },
  }),
];
