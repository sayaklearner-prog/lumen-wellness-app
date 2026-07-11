import os
import zipfile

desktop_path = "/Users/mackbookpro/Desktop"
root_dir = "/Users/mackbookpro/Lumen AI/lumen-wellness-app"

# Clean up older zip files first
for f in ["Frontend 1.zip", "Frontend 2.zip", "lumen-frontend.zip", "lumen-backend.zip"]:
    p = os.path.join(desktop_path, f)
    if os.path.exists(p):
        os.remove(p)

# Helper function to write files to zip selectively
def write_to_zip(zip_file, paths, exclude_patterns, include_only_dir=None, exclude_dir=None):
    for path in paths:
        full_path = os.path.join(root_dir, path)
        if os.path.isdir(full_path):
            for root, dirs, files in os.walk(full_path):
                # Prune excluded directories in-place
                dirs[:] = [d for d in dirs if d not in exclude_patterns]
                
                # Check directory inclusion/exclusion filters
                rel_root = os.path.relpath(root, root_dir)
                if exclude_dir and any(rel_root.startswith(ed) for ed in exclude_dir):
                    continue
                if include_only_dir and not any(rel_root.startswith(ind) for ind in include_only_dir):
                    continue
                    
                for file in files:
                    if any(pattern in file or pattern in root for pattern in exclude_patterns):
                        continue
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, root_dir)
                    zip_file.write(file_path, arcname)
        elif os.path.isfile(full_path):
            if any(pattern in path for pattern in exclude_patterns):
                continue
            arcname = os.path.relpath(full_path, root_dir)
            zip_file.write(full_path, arcname)

global_excludes = [
    "node_modules", ".DS_Store", "__pycache__", ".cache", "venv", 
    "lumen.db", "dist", ".tsbuildinfo", ".replit-artifact", "approve.exp", 
    ".tempmediaStorage", ".dashboard.tsx.swp"
]

# 1. Lumen_Backend.zip (47 files)
with zipfile.ZipFile(os.path.join(desktop_path, "Lumen_Backend.zip"), 'w', zipfile.ZIP_DEFLATED) as z:
    write_to_zip(z, ["backend"], global_excludes)

# 2. Lumen_Frontend_Part_1_Configs.zip (32 files)
part1_paths = [
    "scripts", "lib/api-spec", "lib/db", "lib/integrations-anthropic-ai",
    "lib/integrations", "package.json", "pnpm-workspace.yaml",
    "tsconfig.json", "tsconfig.base.json", ".gitignore", ".replit", ".replitignore"
]
with zipfile.ZipFile(os.path.join(desktop_path, "Lumen_Frontend_Part_1.zip"), 'w', zipfile.ZIP_DEFLATED) as z:
    write_to_zip(z, part1_paths, global_excludes)

# 3. Lumen_Frontend_Part_2_Lib_Client.zip (72 files)
part2_paths = ["lib/api-client-react", "lib/api-zod"]
with zipfile.ZipFile(os.path.join(desktop_path, "Lumen_Frontend_Part_2.zip"), 'w', zipfile.ZIP_DEFLATED) as z:
    write_to_zip(z, part2_paths, global_excludes)

# 4. Lumen_Frontend_Part_3_Wellness_Components.zip (approx 55 files)
with zipfile.ZipFile(os.path.join(desktop_path, "Lumen_Frontend_Part_3.zip"), 'w', zipfile.ZIP_DEFLATED) as z:
    write_to_zip(
        z, 
        ["artifacts/wellness"], 
        global_excludes,
        include_only_dir=["artifacts/wellness/src/components", "artifacts/wellness/public"]
    )

# 5. Lumen_Frontend_Part_4_Wellness_App.zip (approx 60 files)
with zipfile.ZipFile(os.path.join(desktop_path, "Lumen_Frontend_Part_4.zip"), 'w', zipfile.ZIP_DEFLATED) as z:
    write_to_zip(
        z, 
        ["artifacts/wellness"], 
        global_excludes,
        exclude_dir=["artifacts/wellness/src/components", "artifacts/wellness/public"]
    )

# 6. Lumen_Frontend_Part_5_Sandbox.zip (70 files)
with zipfile.ZipFile(os.path.join(desktop_path, "Lumen_Frontend_Part_5.zip"), 'w', zipfile.ZIP_DEFLATED) as z:
    write_to_zip(z, ["artifacts/mockup-sandbox"], global_excludes)

# 7. Lumen_Frontend_Part_6_ApiMock.zip (51 files)
with zipfile.ZipFile(os.path.join(desktop_path, "Lumen_Frontend_Part_6.zip"), 'w', zipfile.ZIP_DEFLATED) as z:
    write_to_zip(z, ["artifacts/api-server"], global_excludes)

print("Generated all partitioned files successfully.")
