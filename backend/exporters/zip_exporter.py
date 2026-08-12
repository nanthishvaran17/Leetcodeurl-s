import io
import zipfile
from backend.exporters.excel_exporter import export_excel_from_dataset
from backend.exporters.pdf_exporter import export_pdf_from_dataset
from backend.exporters.word_exporter import export_word_from_dataset
from backend.exporters.csv_exporter import export_csv_from_dataset

def export_zip_bundle_from_dataset(dataset: dict) -> bytes:
    """
    ZIP BUNDLE EXPORTER
    Packs Excel, PDF, Word, and CSV into a single ZIP file for "Download All Formats".
    """
    report_id = dataset.get("reportId", "REPORT")
    safe_title = dataset.get("title", "Report").replace(" ", "_").replace("/", "-")

    excel_bytes = export_excel_from_dataset(dataset)
    pdf_bytes = export_pdf_from_dataset(dataset)
    word_bytes = export_word_from_dataset(dataset)
    csv_bytes = export_csv_from_dataset(dataset)

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(f"{safe_title}_{report_id}.xlsx", excel_bytes)
        zf.writestr(f"{safe_title}_{report_id}.pdf", pdf_bytes)
        zf.writestr(f"{safe_title}_{report_id}.docx", word_bytes)
        zf.writestr(f"{safe_title}_{report_id}.csv", csv_bytes)

    zip_buffer.seek(0)
    return zip_buffer.getvalue()
