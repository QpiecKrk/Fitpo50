#!/usr/bin/env python3
"""Generate the printable FitPo50 seven-day blood pressure diary."""

from pathlib import Path

from fpdf import FPDF


ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "output" / "pdf" / "dzienniczek-cisnienia-7-dni.pdf"
FONT_REGULAR = Path("/System/Library/Fonts/Supplemental/Arial.ttf")
FONT_BOLD = Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf")


class DiaryPDF(FPDF):
    def __init__(self) -> None:
        super().__init__(orientation="P", unit="mm", format="A4")
        self.set_auto_page_break(auto=False)
        self.set_margins(10, 10, 10)
        self.add_font("FitArial", style="", fname=str(FONT_REGULAR))
        self.add_font("FitArial", style="B", fname=str(FONT_BOLD))
        self.set_title("Dzienniczek ciśnienia - 7 dni")
        self.set_author("FitPo50")
        self.set_creator("FitPo50")

    def header_block(self, title: str, lead: str, page_number: int) -> None:
        self.set_xy(10, 10)
        self.set_text_color(40, 95, 67)
        self.set_font("FitArial", "B", 8)
        self.cell(0, 4, "FITPO50 · NARZĘDZIA")
        self.set_xy(178, 10)
        self.set_text_color(100, 117, 106)
        self.cell(22, 4, f"{page_number} / 2", align="R")
        self.set_xy(10, 16)
        self.set_text_color(24, 49, 38)
        self.set_font("FitArial", "B", 21)
        self.cell(0, 9, title)
        self.set_xy(10, 26)
        self.set_text_color(76, 98, 85)
        self.set_font("FitArial", "", 8.3)
        self.multi_cell(165, 4, lead)
        self.set_draw_color(49, 94, 140)
        self.set_line_width(1.1)
        self.line(10, 36, 200, 36)

    def footer_block(self, left: str) -> None:
        self.set_draw_color(204, 214, 208)
        self.set_line_width(0.2)
        self.line(10, 286, 200, 286)
        self.set_xy(10, 288)
        self.set_text_color(100, 120, 108)
        self.set_font("FitArial", "", 6.3)
        self.cell(160, 4, left)
        self.cell(30, 4, "fitpo50.pl", align="R")

    def steps(self) -> None:
        items = [
            ("30 MINUT WCZEŚNIEJ", "Bez wysiłku, palenia i kofeiny. Opróżnij pęcherz."),
            ("5 MINUT SPOKOJU", "Usiądź, oprzyj plecy i stopy. Nie krzyżuj nóg."),
            ("RAMIĘ I MANKIET", "Mankiet na nagim ramieniu. Ramię na wysokości serca."),
            ("DWA ODCZYTY", "Nie rozmawiaj. Powtórz pomiar po co najmniej minucie."),
        ]
        y = 40
        width = 45.6
        for index, (heading, text) in enumerate(items):
            x = 10 + index * 48.1
            self.set_fill_color(238, 245, 241)
            self.rect(x, y, width, 25, style="F")
            self.set_xy(x + 3, y + 3)
            self.set_text_color(49, 94, 140)
            self.set_font("FitArial", "B", 6.8)
            self.cell(width - 6, 4, heading)
            self.set_xy(x + 3, y + 8)
            self.set_text_color(58, 80, 67)
            self.set_font("FitArial", "", 6.7)
            self.multi_cell(width - 6, 3.2, text)

    def day_table(self, day: int, y: float) -> float:
        self.set_xy(10, y)
        self.set_text_color(24, 49, 38)
        self.set_font("FitArial", "B", 9.2)
        self.cell(24, 6, f"Dzień {day}")
        if day == 1:
            self.set_text_color(135, 90, 34)
            self.set_font("FitArial", "", 6.3)
            self.cell(80, 6, "pomijany w średniej głównej")

        y += 6
        widths = [22, 33, 18, 33, 18, 66]
        headers = ["Pora", "Ciśnienie 1", "Puls", "Ciśnienie 2", "Puls", "Godzina / uwagi"]
        self.set_xy(10, y)
        self.set_fill_color(242, 246, 244)
        self.set_draw_color(174, 189, 180)
        self.set_line_width(0.2)
        self.set_text_color(61, 82, 69)
        self.set_font("FitArial", "B", 6.2)
        for width, heading in zip(widths, headers):
            self.cell(width, 7, heading, border=1, align="C", fill=True)
        y += 7

        for period in ("Rano", "Wieczór"):
            self.set_xy(10, y)
            self.set_text_color(36, 59, 45)
            self.set_font("FitArial", "B", 7.2)
            self.cell(widths[0], 11, period, border=1, align="C", fill=True)
            self.set_font("FitArial", "", 7.4)
            self.cell(widths[1], 11, "____ / ____", border=1, align="C")
            self.cell(widths[2], 11, "____", border=1, align="C")
            self.cell(widths[3], 11, "____ / ____", border=1, align="C")
            self.cell(widths[4], 11, "____", border=1, align="C")
            self.cell(widths[5], 11, "", border=1)
            y += 11
        return y + 3.5

    def summary(self, y: float) -> float:
        self.set_fill_color(242, 247, 251)
        self.set_draw_color(184, 201, 216)
        self.rect(10, y, 92.5, 28, style="DF")
        self.rect(107.5, y, 92.5, 28, style="DF")

        self.set_xy(14, y + 3)
        self.set_text_color(49, 94, 140)
        self.set_font("FitArial", "B", 9)
        self.cell(80, 5, "Średnia z dni 2-7")
        self.set_xy(14, y + 10)
        self.set_text_color(58, 80, 67)
        self.set_font("FitArial", "", 7.3)
        self.cell(80, 5, "Ciśnienie: ________ / ________ mmHg")
        self.set_xy(14, y + 17)
        self.cell(80, 5, "Puls: ______________________ /min")

        self.set_xy(111.5, y + 3)
        self.set_text_color(49, 94, 140)
        self.set_font("FitArial", "B", 9)
        self.cell(82, 5, "Do rozmowy ze specjalistą")
        self.set_xy(111.5, y + 10)
        self.set_text_color(58, 80, 67)
        self.set_font("FitArial", "", 7.3)
        self.cell(82, 5, "Zmiany leków / dawki: __________________")
        self.set_xy(111.5, y + 17)
        self.cell(82, 5, "Objawy lub pytania: ____________________")
        return y + 32

    def notes_box(self, y: float) -> None:
        self.set_xy(10, y)
        self.set_text_color(24, 49, 38)
        self.set_font("FitArial", "B", 9.2)
        self.cell(0, 6, "Notatki z dni 1-3")
        self.set_text_color(90, 108, 97)
        self.set_font("FitArial", "", 6.7)
        self.set_xy(10, y + 6)
        self.cell(0, 4, "Zapisz zmiany leków, objawy, gorszy sen, stres lub inne okoliczności mogące wpływać na pomiar.")
        self.set_draw_color(190, 202, 195)
        for line_y in (y + 17, y + 29, y + 41, y + 53, y + 65):
            self.line(10, line_y, 200, line_y)

    def emergency(self, y: float) -> None:
        self.set_fill_color(255, 240, 237)
        self.set_draw_color(184, 68, 61)
        self.set_line_width(1)
        self.line(10, y, 10, y + 22)
        self.rect(11, y, 189, 22, style="F")
        self.set_xy(15, y + 3)
        self.set_text_color(116, 45, 41)
        self.set_font("FitArial", "B", 7.2)
        self.cell(0, 4, "BARDZO WYSOKI WYNIK")
        self.set_xy(15, y + 8)
        self.set_font("FitArial", "", 6.8)
        self.multi_cell(178, 3.5, "Jeśli ciśnienie skurczowe przekracza 180 mmHg lub rozkurczowe przekracza 120 mmHg, odczekaj co najmniej minutę i zmierz ponownie. Jeżeli nadal jest tak wysokie, pilnie skontaktuj się z pomocą medyczną. Przy bólu w klatce, duszności, osłabieniu, drętwieniu, zaburzeniu widzenia lub mowy dzwoń pod 112 albo 999.")


def generate() -> Path:
    if not FONT_REGULAR.exists() or not FONT_BOLD.exists():
        raise FileNotFoundError("Brak systemowego fontu Arial wymaganego do utworzenia PDF-u.")

    pdf = DiaryPDF()
    pdf.add_page()
    pdf.header_block(
        "Dzienniczek ciśnienia - 7 dni",
        "Dwa pomiary rano i dwa wieczorem, wykonywane w porównywalnych warunkach. Wartości ciśnienia wpisuj w mmHg.",
        1,
    )
    pdf.steps()
    y = 70
    for day in (1, 2, 3):
        y = pdf.day_table(day, y)
    pdf.notes_box(y + 2)
    pdf.footer_block("Materiał edukacyjny - nie zmieniaj leków bez uzgodnienia z lekarzem.")

    pdf.add_page()
    pdf.header_block(
        "Dni 4-7 i podsumowanie",
        "Do średniej głównej wykorzystaj wszystkie zapisane odczyty z dni 2-7. Dzień 1 pozostaje w dzienniczku, ale nie wchodzi do tej średniej.",
        2,
    )
    y = 42
    for day in (4, 5, 6, 7):
        y = pdf.day_table(day, y)
    y = pdf.summary(y + 1)
    pdf.emergency(y + 1)
    pdf.footer_block("Metoda: NICE NG136; technika i bezpieczeństwo: AHA. Weryfikacja: 06.09.2026.")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    return OUTPUT


if __name__ == "__main__":
    print(f"[PDF] {generate()}")
