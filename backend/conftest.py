# This file forces Python to NOT use bytecode caching for any module
# imported from the backend directory. It's automatically loaded by
# Python before any other module in the package.
import os
import sys

os.environ["PYTHONDONTWRITEBYTECODE"] = "1"
sys.dont_write_bytecode = True
