import csv
import io
import os
import re

def update_coordinates():
    csv_path = r"c:\Users\EYA\Desktop\Eya\OneDrive\SUMAN\Antigravity codes\CRMC\CommunityData.csv"
    js_path = r"c:\Users\EYA\Desktop\Eya\OneDrive\SUMAN\Antigravity codes\CRMC\communities_static.js"
    
    if not os.path.exists(csv_path):
        print(f"Error: {csv_path} not found.")
        return
    
    # Read the CSV (Transposed format)
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = list(csv.reader(f))
        
    # Row indices (0-based)
    # 0: Names
    # 1: Latitude
    # 2: Longitude
    # 7: Community Code
    
    codes = [c.strip() for c in reader[7][1:]]
    lats = [c.strip() for c in reader[1][1:]]
    lngs = [c.strip() for c in reader[2][1:]]
    
    coord_map = {}
    for i in range(len(codes)):
        if codes[i]:
            coord_map[codes[i]] = {'lat': lats[i], 'lng': lngs[i]}
            
    # Read JS file
    with open(js_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    new_lines = []
    update_count = 0
    
    data_started = False
    for line in lines:
        if '"data": [' in line:
            data_started = True
            new_lines.append(line)
            continue
        if data_started and ']' in line:
            data_started = False
            new_lines.append(line)
            continue
            
        if data_started and line.strip().startswith('"'):
            # This is a data row
            # Extract content between first and last quote
            # Handle escaped quotes \"
            raw_line = line.strip()
            # Remove trailing comma if present
            has_comma = raw_line.endswith(',')
            content_match = re.search(r'^"(.*)"', raw_line.rstrip(','))
            if content_match:
                csv_str = content_match.group(1)
                # Unescape quotes \" -> "
                unescaped_csv = csv_str.replace('\\"', '"')
                
                # Parse as CSV
                f_csv = io.StringIO(unescaped_csv)
                csv_reader = csv.reader(f_csv)
                parts = next(csv_reader)
                
                code = parts[0]
                if code in coord_map:
                    # Update Lat (5) and Lng (6)
                    if len(parts) > 6:
                        parts[5] = coord_map[code]['lat']
                        parts[6] = coord_map[code]['lng']
                        update_count += 1
                
                # Re-serialize to CSV
                output = io.StringIO()
                csv_writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)
                csv_writer.writerow(parts)
                new_csv_str = output.getvalue().strip()
                
                # Re-escape quotes " -> \"
                escaped_csv = new_csv_str.replace('"', '\\"')
                
                # Reconstruct line
                prefix = line[:line.find('"')]
                suffix = ',\n' if has_comma else '\n'
                new_lines.append(f'{prefix}"{escaped_csv}"{suffix}')
            else:
                new_lines.append(line)
        else:
            new_lines.append(line)
            
    with open(js_path, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
        
    print(f"Successfully updated {update_count} community coordinates in {js_path}")

if __name__ == "__main__":
    update_coordinates()
