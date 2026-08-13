import io
import re
import zipfile
from backend.exporters.excel_exporter import export_excel_from_dataset
from backend.exporters.pdf_exporter import export_pdf_from_dataset
from backend.exporters.word_exporter import export_word_from_dataset

def export_zip_bundle_from_dataset(dataset: dict) -> bytes:
    """
    ZIP BUNDLE EXPORTER
    Packs Excel, PDF, and Word into a single ZIP file with dynamic Weekly_Contest_XXX filenames.
    """
    contest_name = dataset.get("contestName") or dataset.get("title", "")
    match = re.search(r'\d+', contest_name)
    if match:
        filename_base = f"Weekly_Contest_{match.group(0)}"
    else:
        report_id = dataset.get("reportId", "REPORT")
        filename_base = f"Weekly_Contest_{report_id}"

    excel_bytes = export_excel_from_dataset(dataset)
    pdf_bytes = export_pdf_from_dataset(dataset)
    word_bytes = export_word_from_dataset(dataset)

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(f"{filename_base}.xlsx", excel_bytes)
        zf.writestr(f"{filename_base}.pdf", pdf_bytes)
        zf.writestr(f"{filename_base}.docx", word_bytes)

    zip_buffer.seek(0)
    return zip_buffer.getvalue()
