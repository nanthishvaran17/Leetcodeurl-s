@echo off
echo Generating PDF and DOCX reports...

REM Check if pandoc is installed
where pandoc >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Pandoc is not installed or not in PATH. Please install it from https://pandoc.org/installing.html
    exit /b 1
)

REM Check if soffice (LibreOffice) is installed for PDF conversion
where soffice >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] soffice ^(LibreOffice^) is not in PATH. 
    echo Please add LibreOffice\program to your system PATH to generate the PDF.
    exit /b 1
)

echo Converting Markdown to DOCX...
pandoc "E:\Leetcode Web\report_output\report_source.md" -o "E:\Leetcode Web\report_output\Nandha_Coding_Intelligence_Platform_Report.docx"
if %errorlevel% neq 0 (
    echo [ERROR] Failed to generate DOCX.
    exit /b 1
)
echo DOCX generated successfully.

echo Converting DOCX to PDF using LibreOffice headless...
soffice --headless --convert-to pdf --outdir "E:\Leetcode Web\report_output" "E:\Leetcode Web\report_output\Nandha_Coding_Intelligence_Platform_Report.docx"
if %errorlevel% neq 0 (
    echo [ERROR] Failed to generate PDF.
    exit /b 1
)
echo PDF generated successfully.
echo.
echo All reports generated in E:\Leetcode Web\report_output\
pause
