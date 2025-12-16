"""Enable running as: python -m live_poker_bench"""

import os

# Suppress litellm verbose output before any imports
os.environ["LITELLM_LOG"] = "ERROR"

from live_poker_bench.main import main

if __name__ == "__main__":
    main()
