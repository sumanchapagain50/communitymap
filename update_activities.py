
import csv
import io

with open("c:\\Users\\EYA\\Desktop\\Eya\\OneDrive\\SUMAN\\Antigravity codes\\CRMC\\activities_static.js", "r") as f:
    content = f.read()

# Extract the CSV part
start = content.find('"') + 1
end = content.rfind('"')
csv_content = content[start:end]

# PapaParse uses \n, but raw CSV might have escaped newlines if it was a single line string.
# Actually, the file shows as multiple lines in the prompt but it's a single line variable. 
# Wait, view_file showed it as multiple lines in the output because it's a string containing \n.
csv_content = csv_content.replace("\\n", "\n")

reader = csv.DictReader(io.StringIO(csv_content))
fieldnames = reader.fieldnames

# New fieldnames
new_fieldnames = list(fieldnames)
# current fields: Id,Name,IndicatorIds,CommunityIds,KnowledgeGenerated,Year,Quarter,Description,KnowledgeLink,Men,Women,OldMen,OldWomen,NewMen,NewWomen
# Insert KnowledgeTitle after KnowledgeGenerated
idx = new_fieldnames.index("KnowledgeGenerated") + 1
new_fieldnames.insert(idx, "KnowledgeTitle")

rows = []
for row in reader:
    name = row["Name"]
    row_id = row["Id"]
    kt = ""
    if name == "Community Health Post Rehabilitation":
        if row_id == "act_01_1": kt = "Health Post Infrastructure Resilience 2026"
        elif row_id == "act_01_2": kt = "Lessons from Rehabilitation Works"
        elif row_id == "act_01_3": kt = "Baidi Health Post Structural Case Study"
        elif row_id == "act_01_4": kt = "Rehabilitation Progress Report"
        else: kt = "Health Post Case Study"
    elif row.get("KnowledgeGenerated") == "true":
        kt = f"Learning Document: {name}"
    
    row["KnowledgeTitle"] = kt
    rows.append(row)

output_io = io.StringIO()
writer = csv.DictWriter(output_io, fieldnames=new_fieldnames, lineterminator="\n")
writer.writeheader()
writer.writerows(rows)

new_csv = output_io.getvalue().replace("\n", "\\n")
new_content = 'const activitiesDataStaticRaw = "' + new_csv + '";'

with open("c:\\Users\\EYA\\Desktop\\Eya\\OneDrive\\SUMAN\\Antigravity codes\\CRMC\\activities_static.js", "w") as f:
    f.write(new_content)

print("Success")
