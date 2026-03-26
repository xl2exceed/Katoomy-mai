import re

content = open("app/[slug]/book/page.tsx", encoding="utf-8").read()

# Replace the entire file with new step-based content
# Strategy: use Edit operations instead

print("File length:", len(content))
print("Has showTimeSelection:", "showTimeSelection" in content)
