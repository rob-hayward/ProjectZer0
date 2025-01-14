import os

# Repo details
repo_owner = "rob-hayward"
repo_name = "ProjectZer0"
branch = "main"

# Base URL for raw GitHub content
base_url = f"https://raw.githubusercontent.com/{repo_owner}/{repo_name}/{branch}/"

# Output file for raw URLs
output_file = "raw_urls.txt"

# Directories and files to ignore
ignore_dirs = {'node_modules', '.git', 'dist', '__pycache__', '.idea', '.vscode'}
ignore_files = {'package-lock.json', 'yarn.lock', '.DS_Store', '.gitignore'}
allowed_extensions = {'.svelte', '.ts', '.js', '.json', '.html', '.css', '.md'}

# Generate raw URLs
raw_urls = []
for root, dirs, files in os.walk("."):
    # Skip ignored directories
    dirs[:] = [d for d in dirs if d not in ignore_dirs]
    
    for file in files:
        # Check for allowed extensions and skip ignored files
        if (
            file not in ignore_files
            and any(file.endswith(ext) for ext in allowed_extensions)
        ):
            # Build relative path and raw URL
            relative_path = os.path.relpath(os.path.join(root, file), ".")
            raw_urls.append(base_url + relative_path.replace("\\", "/"))

# Save to file (overwrite existing file)
with open(output_file, "w") as f:
    f.write("\n".join(raw_urls))

print(f"Filtered raw URLs saved to {output_file}")
