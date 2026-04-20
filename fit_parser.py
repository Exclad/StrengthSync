"""FIT file reader module.

Uses fit-tool (read path) and fitparse (verification).
Phase 1: minimal stub — Phase 2 extends with full field extraction.
"""
from fit_tool.fit_file import FitFile


def read_fit_file(path: str) -> FitFile:
    """Read a FIT file using fit-tool. Returns a FitFile object.

    Args:
        path: Absolute or relative path to the .fit file.

    Returns:
        FitFile object with .records list and .header.

    Raises:
        FileNotFoundError: If path does not exist.
        RuntimeError: If fit-tool cannot parse the file.
    """
    raise NotImplementedError("Phase 2 implements full field extraction")
