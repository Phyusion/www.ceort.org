import { z } from "zod";
import {
  defineTool,
  BodyTypeSchema,
  EmailAddressSchema,
  toBody,
  toRecipients,
  type ToolDefinition,
} from "./shared.js";

const EventListSelect =
  "id,subject,bodyPreview,start,end,location,attendees,organizer,isAllDay,isCancelled,showAs,onlineMeeting,webLink,responseStatus";

const DateTimeZoneSchema = z.object({
  dateTime: z
    .string()
    .describe("ISO-8601 local datetime without offset, e.g. '2026-04-15T09:00:00'"),
  timeZone: z
    .string()
    .default("UTC")
    .describe("IANA or Windows timezone name, e.g. 'America/New_York' or 'Pacific Standard Time'"),
});

const AttendeeSchema = EmailAddressSchema.extend({
  type: z.enum(["required", "optional", "resource"]).default("required"),
});

function toAttendees(attendees: z.infer<typeof AttendeeSchema>[] | undefined) {
  if (!attendees || attendees.length === 0) return undefined;
  return attendees.map((a) => ({
    emailAddress: { address: a.address, name: a.name },
    type: a.type,
  }));
}

export const calendarTools: ToolDefinition[] = [
  defineTool({
    name: "outlook_list_calendars",
    description: "List calendars available to the user (primary + additional calendars).",
    inputSchema: z.object({}),
    async handler(_, { graph, scope }) {
      const res = await graph
        .api(`${scope}/calendars`)
        .select("id,name,color,isDefaultCalendar,canEdit,owner")
        .get();
      return res.value;
    },
  }),

  defineTool({
    name: "outlook_list_events",
    description:
      "List calendar events ordered by start time. Supports an OData filter and pagination. For time-bounded views over recurring events use outlook_list_event_instances.",
    inputSchema: z.object({
      calendarId: z
        .string()
        .optional()
        .describe("Calendar id; omit to use the default calendar."),
      top: z.number().int().min(1).max(200).default(50),
      skip: z.number().int().min(0).default(0),
      filter: z.string().optional(),
      orderby: z.string().default("start/dateTime asc"),
    }),
    async handler({ calendarId, top, skip, filter, orderby }, { graph, scope }) {
      const base = calendarId ? `${scope}/calendars/${calendarId}/events` : `${scope}/events`;
      let req = graph.api(base).top(top).skip(skip).orderby(orderby).select(EventListSelect);
      if (filter) req = req.filter(filter);
      const res = await req.get();
      return res.value;
    },
  }),

  defineTool({
    name: "outlook_list_event_instances",
    description:
      "Get calendar events (including expanded recurring instances) between startDateTime and endDateTime. Use this for 'what's on my calendar next week' queries.",
    inputSchema: z.object({
      calendarId: z.string().optional(),
      startDateTime: z.string().describe("ISO-8601 start, e.g. '2026-04-15T00:00:00'"),
      endDateTime: z.string().describe("ISO-8601 end, e.g. '2026-04-22T00:00:00'"),
      top: z.number().int().min(1).max(200).default(100),
    }),
    async handler({ calendarId, startDateTime, endDateTime, top }, { graph, scope }) {
      const base = calendarId
        ? `${scope}/calendars/${calendarId}/calendarView`
        : `${scope}/calendarView`;
      const res = await graph
        .api(base)
        .query({ startDateTime, endDateTime })
        .top(top)
        .orderby("start/dateTime asc")
        .select(EventListSelect)
        .get();
      return res.value;
    },
  }),

  defineTool({
    name: "outlook_get_event",
    description: "Fetch a single calendar event by id, including body and full attendee list.",
    inputSchema: z.object({
      eventId: z.string(),
      bodyFormat: z.enum(["text", "html"]).default("text"),
    }),
    async handler({ eventId, bodyFormat }, { graph, scope }) {
      return graph
        .api(`${scope}/events/${eventId}`)
        .header("Prefer", `outlook.body-content-type="${bodyFormat}"`)
        .get();
    },
  }),

  defineTool({
    name: "outlook_create_event",
    description:
      "Create a calendar event. Set isOnlineMeeting=true to automatically attach a Teams meeting. recurrence follows the Graph patternedRecurrence shape.",
    inputSchema: z.object({
      calendarId: z.string().optional(),
      subject: z.string(),
      body: z.string().default(""),
      bodyType: BodyTypeSchema,
      start: DateTimeZoneSchema,
      end: DateTimeZoneSchema,
      location: z.string().optional(),
      attendees: z.array(AttendeeSchema).optional(),
      isAllDay: z.boolean().default(false),
      isOnlineMeeting: z.boolean().default(false),
      importance: z.enum(["low", "normal", "high"]).default("normal"),
      reminderMinutesBeforeStart: z.number().int().min(0).optional(),
      showAs: z
        .enum(["free", "tentative", "busy", "oof", "workingElsewhere", "unknown"])
        .optional(),
      recurrence: z
        .any()
        .optional()
        .describe("Optional patternedRecurrence object per Microsoft Graph schema."),
    }),
    async handler(args, { graph, scope }) {
      const payload: Record<string, unknown> = {
        subject: args.subject,
        body: toBody(args.body, args.bodyType),
        start: args.start,
        end: args.end,
        isAllDay: args.isAllDay,
        isOnlineMeeting: args.isOnlineMeeting,
        importance: args.importance,
      };
      if (args.location) payload.location = { displayName: args.location };
      const attendees = toAttendees(args.attendees);
      if (attendees) payload.attendees = attendees;
      if (args.reminderMinutesBeforeStart !== undefined) {
        payload.reminderMinutesBeforeStart = args.reminderMinutesBeforeStart;
      }
      if (args.showAs) payload.showAs = args.showAs;
      if (args.recurrence) payload.recurrence = args.recurrence;

      const base = args.calendarId
        ? `${scope}/calendars/${args.calendarId}/events`
        : `${scope}/events`;
      return graph.api(base).post(payload);
    },
  }),

  defineTool({
    name: "outlook_update_event",
    description:
      "Patch fields on an existing event. Only provided fields are updated. For recurring events this updates the series; pass an occurrence id to update a single instance.",
    inputSchema: z.object({
      eventId: z.string(),
      subject: z.string().optional(),
      body: z.string().optional(),
      bodyType: BodyTypeSchema.optional(),
      start: DateTimeZoneSchema.optional(),
      end: DateTimeZoneSchema.optional(),
      location: z.string().optional(),
      attendees: z.array(AttendeeSchema).optional(),
      isAllDay: z.boolean().optional(),
      isOnlineMeeting: z.boolean().optional(),
      importance: z.enum(["low", "normal", "high"]).optional(),
      reminderMinutesBeforeStart: z.number().int().min(0).optional(),
      showAs: z
        .enum(["free", "tentative", "busy", "oof", "workingElsewhere", "unknown"])
        .optional(),
    }),
    async handler(args, { graph, scope }) {
      const patch: Record<string, unknown> = {};
      if (args.subject !== undefined) patch.subject = args.subject;
      if (args.body !== undefined) {
        patch.body = toBody(args.body, args.bodyType ?? "text");
      }
      if (args.start) patch.start = args.start;
      if (args.end) patch.end = args.end;
      if (args.location !== undefined) patch.location = { displayName: args.location };
      const attendees = toAttendees(args.attendees);
      if (attendees) patch.attendees = attendees;
      if (args.isAllDay !== undefined) patch.isAllDay = args.isAllDay;
      if (args.isOnlineMeeting !== undefined) patch.isOnlineMeeting = args.isOnlineMeeting;
      if (args.importance !== undefined) patch.importance = args.importance;
      if (args.reminderMinutesBeforeStart !== undefined) {
        patch.reminderMinutesBeforeStart = args.reminderMinutesBeforeStart;
      }
      if (args.showAs !== undefined) patch.showAs = args.showAs;
      return graph.api(`${scope}/events/${args.eventId}`).patch(patch);
    },
  }),

  defineTool({
    name: "outlook_delete_event",
    description:
      "Delete a calendar event. If the event has attendees, use outlook_cancel_event instead so invitees are notified.",
    inputSchema: z.object({ eventId: z.string() }),
    async handler({ eventId }, { graph, scope }) {
      await graph.api(`${scope}/events/${eventId}`).delete();
      return { ok: true };
    },
  }),

  defineTool({
    name: "outlook_cancel_event",
    description: "Cancel a meeting organized by the user and notify attendees with an optional comment.",
    inputSchema: z.object({
      eventId: z.string(),
      comment: z.string().default(""),
    }),
    async handler({ eventId, comment }, { graph, scope }) {
      await graph.api(`${scope}/events/${eventId}/cancel`).post({ comment });
      return { ok: true };
    },
  }),

  defineTool({
    name: "outlook_respond_to_event",
    description:
      "Respond to a meeting invite as accept, tentativelyAccept, or decline. Set sendResponse=false to update status silently.",
    inputSchema: z.object({
      eventId: z.string(),
      response: z.enum(["accept", "tentativelyAccept", "decline"]),
      comment: z.string().default(""),
      sendResponse: z.boolean().default(true),
    }),
    async handler({ eventId, response, comment, sendResponse }, { graph, scope }) {
      await graph
        .api(`${scope}/events/${eventId}/${response}`)
        .post({ comment, sendResponse });
      return { ok: true };
    },
  }),

  defineTool({
    name: "outlook_find_meeting_times",
    description:
      "Ask Graph to suggest meeting times that work for a set of attendees within a date range.",
    inputSchema: z.object({
      attendees: z.array(EmailAddressSchema).min(1),
      meetingDurationMinutes: z.number().int().min(15).max(1440).default(30),
      startDateTime: z.string(),
      endDateTime: z.string(),
      timeZone: z.string().default("UTC"),
      maxCandidates: z.number().int().min(1).max(20).default(5),
    }),
    async handler(args, { graph, scope }) {
      const body = {
        attendees: args.attendees.map((a) => ({
          emailAddress: { address: a.address, name: a.name },
          type: "Required",
        })),
        timeConstraint: {
          activityDomain: "work",
          timeSlots: [
            {
              start: { dateTime: args.startDateTime, timeZone: args.timeZone },
              end: { dateTime: args.endDateTime, timeZone: args.timeZone },
            },
          ],
        },
        meetingDuration: `PT${args.meetingDurationMinutes}M`,
        maxCandidates: args.maxCandidates,
      };
      return graph.api(`${scope}/findMeetingTimes`).post(body);
    },
  }),

  defineTool({
    name: "outlook_get_schedule",
    description:
      "Fetch free/busy info for one or more mailboxes over a time range. Availability view returns a packed string (0=free,1=tentative,2=busy,3=oof,4=workingElsewhere).",
    inputSchema: z.object({
      schedules: z.array(z.string().email()).min(1),
      startDateTime: z.string(),
      endDateTime: z.string(),
      timeZone: z.string().default("UTC"),
      availabilityViewInterval: z.number().int().min(5).max(1440).default(60),
    }),
    async handler(args, { graph, scope }) {
      return graph.api(`${scope}/calendar/getSchedule`).post({
        schedules: args.schedules,
        startTime: { dateTime: args.startDateTime, timeZone: args.timeZone },
        endTime: { dateTime: args.endDateTime, timeZone: args.timeZone },
        availabilityViewInterval: args.availabilityViewInterval,
      });
    },
  }),
];
