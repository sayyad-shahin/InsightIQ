"""Render a Report's computed sections into a real PDF using reportlab."""

from __future__ import annotations

import io
from typing import Any

from app.models.report import Report


def _clean(text: str) -> str:
    return str(text).replace("**", "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def generate_report_pdf(report: Report) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_LEFT
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        HRFlowable,
        ListFlowable,
        ListItem,
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )

    sections: dict[str, Any] = report.sections or {}
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=20 * mm, bottomMargin=18 * mm, leftMargin=18 * mm, rightMargin=18 * mm)

    styles = getSampleStyleSheet()
    brand = colors.HexColor("#4f6ef7")
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], textColor=brand, fontSize=22, spaceAfter=4)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontSize=13, textColor=colors.HexColor("#1f2937"), spaceBefore=14, spaceAfter=6)
    body = ParagraphStyle("body", parent=styles["BodyText"], fontSize=10, leading=15, alignment=TA_LEFT)
    muted = ParagraphStyle("muted", parent=body, textColor=colors.HexColor("#6b7280"), fontSize=9)

    story: list[Any] = [
        Paragraph(_clean(report.title), h1),
        Paragraph("InsightIQ · AI Decision Intelligence report", muted),
        HRFlowable(width="100%", color=colors.HexColor("#e5e7eb"), spaceBefore=8, spaceAfter=4),
    ]

    overview = sections.get("overview", {})
    if overview:
        story.append(Paragraph("Overview", h2))
        rows = [
            ["Dataset", str(overview.get("dataset_name", "—"))],
            ["Source type", str(overview.get("source_type", "—")).upper()],
            ["Rows", f"{overview.get('row_count', '—'):,}" if isinstance(overview.get("row_count"), int) else "—"],
            ["Columns", str(overview.get("column_count", "—"))],
        ]
        table = Table(rows, colWidths=[45 * mm, 120 * mm])
        table.setStyle(
            TableStyle(
                [
                    ("FONTSIZE", (0, 0), (-1, -1), 10),
                    ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#6b7280")),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ("LINEBELOW", (0, 0), (-1, -2), 0.4, colors.HexColor("#eef2f7")),
                ]
            )
        )
        story += [table, Spacer(1, 4)]

    highlights = sections.get("highlights", {})
    if highlights:
        story.append(Paragraph("Highlights", h2))
        bullets = []
        if "quality_score" in highlights:
            bullets.append(f"Data quality score: {highlights['quality_score']}/100")
        if highlights.get("primary_measure"):
            total = highlights.get("primary_total")
            bullets.append(f"Primary measure: {highlights['primary_measure']}" + (f" (total {total:,.0f})" if isinstance(total, (int, float)) else ""))
        if "trend_change_pct" in highlights:
            bullets.append(f"Trend change over the period: {highlights['trend_change_pct']:+}%")
        story.append(_bullets(bullets, body, ListFlowable, ListItem, Paragraph))

    insights = sections.get("insights", {})
    for key, label in [
        ("key_insights", "Key insights"),
        ("revenue_drivers", "Revenue drivers"),
        ("growth_trends", "Growth trends"),
        ("opportunities", "Opportunities"),
        ("risks", "Risks"),
        ("recommendations", "Executive recommendations"),
    ]:
        items = insights.get(key) if isinstance(insights, dict) else None
        if items:
            story.append(Paragraph(label, h2))
            story.append(_bullets([_clean(i) for i in items], body, ListFlowable, ListItem, Paragraph))

    dq = sections.get("data_quality", {})
    if dq:
        story.append(Paragraph("Data quality", h2))
        dq_bullets = [
            f"Total rows: {dq.get('total_rows', '—')}",
            f"Duplicate rows: {dq.get('duplicate_rows', 0)}",
            f"Columns with missing values: {', '.join(dq.get('columns_with_missing_values') or []) or 'none'}",
        ]
        story.append(_bullets(dq_bullets, body, ListFlowable, ListItem, Paragraph))

    doc.build(story)
    return buffer.getvalue()


def _bullets(items, style, ListFlowable, ListItem, Paragraph):
    return ListFlowable(
        [ListItem(Paragraph(i, style), leftIndent=10) for i in items],
        bulletType="bullet",
        bulletColor="#4f6ef7",
        start="•",
    )
