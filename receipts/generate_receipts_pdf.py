from fpdf import FPDF

receipts = [
    {
        "title": "Receipt 1 - Tailwind DC, LLC (Meal)",
        "lines": [
            ("Merchant", "Tailwind DC, LLC"),
            ("Address", "Union Station, 50 Massachusetts Ave. NE, Washington, DC 20002"),
            ("Date / Time", "04/28/2026  5:55 PM"),
            ("Order / Check", "21415 / Check 1, Table 10"),
            ("Server", "Javier"),
            ("Card Type", "Mastercard ending in 1133"),
            ("Auth Code", "02852Q"),
            ("Acceptor ID", "4445070707062"),
            ("Ref No.", "1361962509"),
            ("Entry", "EMV Contactless"),
            ("Check Total", "$35.89"),
            ("Charge Amount", "$35.89"),
            ("Tip", "$8.00"),
            ("Total", "$43.89"),
        ],
    },
    {
        "title": "Receipt 2 - Curb Mobility (Taxi, Passenger Copy)",
        "lines": [
            ("Merchant", "Curb Mobility"),
            ("Contact", "1-800-488-8704  |  cs@gocurb.com"),
            ("Address", "11-11 34th Ave, LIC, NY 11797"),
            ("Date", "4/23/2026"),
            ("Trip Start / End", "08:17:50 - 08:25:11"),
            ("Trip No.", "6285"),
            ("Driver / Cab", "5773591 / 8P30"),
            ("Passengers", "1"),
            ("Rate", "Standard City Rate 1"),
            ("Distance", "1.33 mi"),
            ("Fare R1", "$9.30"),
            ("Subtotal", "$9.30"),
            ("Tip", "$2.81"),
            ("State Surcharge", "$0.50"),
            ("Improvement Surcharge", "$1.00"),
            ("Congestion Surcharge", "$2.50"),
            ("CRZ Toll", "$0.75"),
            ("Total", "$16.86"),
            ("Card", "Mastercard ending in 1133"),
            ("Auth Code", "023710"),
            ("TRN Ref No.", "156430540"),
        ],
    },
    {
        "title": "Receipt 3 - Curb Mobility (Taxi, Driver Copy)",
        "lines": [
            ("Merchant", "Curb Mobility"),
            ("Contact", "1-800-488-8704  |  cs@gocurb.com"),
            ("Address", "11-11 34th Ave, LIC, NY 11797"),
            ("Date", "4/22/2026"),
            ("Trip Start / End", "15:35:49 - 16:07:58"),
            ("Trip No.", "4838"),
            ("Driver / Cab", "5595798 / 3M92"),
            ("Passengers", "1"),
            ("Rate", "Standard City Rate 1"),
            ("Distance", "5.74 mi"),
            ("Fare R1", "$32.40"),
            ("Midtown Tunnel", "$7.46"),
            ("Subtotal", "$39.86"),
            ("Tip", "$11.15"),
            ("State Surcharge", "$0.50"),
            ("Improvement Surcharge", "$1.00"),
            ("Congestion Surcharge", "$2.50"),
            ("CRZ Toll", "$0.75"),
            ("Total", "$55.76"),
            ("Card", "Mastercard ending in 1133"),
            ("Auth Code", "02276Q"),
            ("TRN Ref No.", "156371676"),
            ("AID", "A0000000041010"),
        ],
    },
    {
        "title": "Receipt 4 - The Westin San Diego Gaslamp Quarter (Meal)",
        "lines": [
            ("Merchant", "The Westin San Diego Gaslamp Quarter"),
            ("Address", "910 Broadway Circle, San Diego, California 92101"),
            ("Phone", "619-239-2200"),
            ("Date / Time", "4/20/2026  12:47 PM"),
            ("Check", "CHK 5902"),
            ("Server", "910090287 ERNIE R."),
            ("Card Type", "Mastercard ending in 1133"),
            ("Auth Code", "02083Q"),
            ("Amount", "$126.07"),
            ("Gratuity", "(left blank on receipt)"),
            ("Grand Total", "(left blank on receipt)"),
        ],
    },
]


class ReceiptPDF(FPDF):
    def header(self):
        self.set_font("Helvetica", "B", 14)
        self.cell(0, 8, "Expense Report - Receipts", ln=True, align="C")
        self.set_font("Helvetica", "", 9)
        self.cell(0, 5, "Compiled 2026-05-11", ln=True, align="C")
        self.ln(2)
        self.set_draw_color(180, 180, 180)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(4)

    def footer(self):
        self.set_y(-12)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 8, f"Page {self.page_no()}", align="C")
        self.set_text_color(0, 0, 0)

    def receipt_block(self, title, lines):
        self.set_font("Helvetica", "B", 12)
        self.set_fill_color(235, 240, 250)
        self.cell(0, 8, title, ln=True, fill=True)
        self.ln(2)
        label_w = 55
        value_w = 210 - 15 - 15 - label_w
        for label, value in lines:
            self.set_x(self.l_margin)
            self.set_font("Helvetica", "B", 10)
            self.cell(label_w, 6, f"{label}:", border=0)
            self.set_font("Helvetica", "", 10)
            self.multi_cell(value_w, 6, value)
        self.ln(4)


def build():
    pdf = ReceiptPDF(orientation="P", unit="mm", format="Letter")
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.set_margins(15, 15, 15)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 7, "Summary", ln=True)
    pdf.set_font("Helvetica", "", 10)
    summary_rows = [
        ("2026-04-20", "The Westin San Diego Gaslamp Quarter (meal)", "$126.07"),
        ("2026-04-22", "Curb Mobility taxi (NYC, 5.74 mi)", "$55.76"),
        ("2026-04-23", "Curb Mobility taxi (NYC, 1.33 mi)", "$16.86"),
        ("2026-04-28", "Tailwind DC (meal, Union Station)", "$43.89"),
    ]
    pdf.set_fill_color(245, 245, 245)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(30, 7, "Date", border=1, fill=True)
    pdf.cell(115, 7, "Description", border=1, fill=True)
    pdf.cell(35, 7, "Amount", border=1, fill=True, align="R")
    pdf.ln()
    pdf.set_font("Helvetica", "", 10)
    total = 0.0
    for date, desc, amount in summary_rows:
        pdf.cell(30, 6, date, border=1)
        pdf.cell(115, 6, desc, border=1)
        pdf.cell(35, 6, amount, border=1, align="R")
        pdf.ln()
        total += float(amount.replace("$", "").replace(",", ""))
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(145, 7, "Total", border=1, align="R")
    pdf.cell(35, 7, f"${total:,.2f}", border=1, align="R")
    pdf.ln(12)

    pdf.set_font("Helvetica", "I", 9)
    pdf.set_text_color(110, 110, 110)
    pdf.multi_cell(
        0,
        5,
        "Note: All charges below were paid with the same Mastercard ending in 1133. "
        "Westin San Diego receipt was not finalized with gratuity at the time of "
        "printing; final amount may differ from $126.07 once tip is posted.",
    )
    pdf.set_text_color(0, 0, 0)
    pdf.ln(4)

    for r in receipts:
        if pdf.get_y() > 220:
            pdf.add_page()
        pdf.receipt_block(r["title"], r["lines"])

    out = "/home/user/www.ceort.org/receipts/expense_receipts.pdf"
    pdf.output(out)
    print(f"Wrote {out}")


if __name__ == "__main__":
    build()
