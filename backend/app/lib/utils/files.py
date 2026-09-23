#: What a PDF sent to a model may weigh. Above this the provider refuses the
#: document anyway, and the refusal reaches the reader as an integration error
#: instead of as the file being too big.
MAX_PDF_BYTES = 20 * 1024 * 1024

_PDF_MAGIC = b'%PDF-'


def unreadable_pdf_reason(*, filename: str, content: bytes) -> str | None:
    """Why this upload cannot be read as a PDF, or None when it can.

    The bytes decide, not the name: a .pdf that is not one comes back from the
    provider as an unhelpful integration failure.
    """
    if not content:
        return 'O arquivo enviado está vazio.'
    if len(content) > MAX_PDF_BYTES:
        return (
            f'O arquivo tem {len(content) // (1024 * 1024)} MB e o limite é '
            f'{MAX_PDF_BYTES // (1024 * 1024)} MB.'
        )
    if not content.startswith(_PDF_MAGIC):
        return f'O arquivo {filename} não é um PDF.'
    return None
