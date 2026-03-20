const fs = require('fs');
const path = require('path');

// Helper to sanitize CSV values
function escapeCSV(val) {
    if (val === null || val === undefined) return '';
    let str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        str = '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

// 1. Migrate Communities
console.log('Migrating Communities...');
const communitiesContent = fs.readFileSync('communities.js', 'utf8');
const communitiesMatch = communitiesContent.match(/const communities\s*=\s*([\s\S]*?);/);
if (communitiesMatch) {
    const communitiesDataStr = communitiesMatch[1];
    const communities = eval('(' + communitiesDataStr + ')');
    const communityFolder = 'community';

    communities.forEach(c => {
        const headers = ['Id', 'Name', 'Country', 'Province', 'District', 'Lat', 'Lng', 'T0_Score', 'T1_Score', 'TotalPop', 'Male', 'Female', 'Children', 'Elderly', 'Disabilities', 'HHs', 'Description'];
        
        // Add indicator headers
        const indicatorIds = [];
        if (c.gradings) {
            Object.keys(c.gradings).sort().forEach(id => {
                indicatorIds.push(id);
                headers.push(`${id}_t0`, `${id}_t1`);
            });
        }

        const row = [
            c.id, c.name, c.country, c.province || '', c.district || '',
            c.coords[0], c.coords[1], c.t0_score, c.t1_score,
            c.demographics.total, c.demographics.male, c.demographics.female,
            c.demographics.children, c.demographics.elderly, c.demographics.disabilities,
            c.demographics.hhs || 0, c.demographics.description || ''
        ];

        if (c.gradings) {
            indicatorIds.forEach(id => {
                row.push(c.gradings[id].t0, c.gradings[id].t1);
            });
        }

        const csvContent = headers.map(escapeCSV).join(',') + '\n' + row.map(escapeCSV).join(',');
        fs.writeFileSync(path.join(communityFolder, `${c.id}.csv`), csvContent);
    });
    // Write manifest for the app to know which files to load
    fs.writeFileSync(path.join(communityFolder, 'manifest.json'), JSON.stringify(communities.map(c => c.id)));
    console.log(`Migrated ${communities.length} communities.`);
}

// 2. Migrate Activities
console.log('Migrating Activities...');
const activitiesContent = fs.readFileSync('activities.js', 'utf8');
const activitiesMatch = activitiesContent.match(/const activities\s*=\s*([\s\S]*?);/);
if (activitiesMatch) {
    const activitiesDataStr = activitiesMatch[1];
    // Use eval to parse the JS array (since it's not strict JSON)
    const activities = eval('(' + activitiesDataStr + ')');
    const activityFolder = 'activity';

    const headers = ['Id', 'Name', 'IndicatorIds', 'CommunityIds', 'KnowledgeGenerated', 'Men', 'Women', 'OldMen', 'OldWomen', 'NewMen', 'NewWomen'];
    const rows = activities.map(a => [
        a.id, a.name, a.indicatorIds.join(';'), a.communityIds.join(';'),
        a.knowledgeGenerated,
        a.beneficiaries.men, a.beneficiaries.women, a.beneficiaries.oldMen, a.beneficiaries.oldWomen,
        a.beneficiaries.newMen, a.beneficiaries.newWomen
    ]);

    const csvContent = [headers.map(escapeCSV).join(',')].concat(rows.map(r => r.map(escapeCSV).join(','))).join('\n');
    fs.writeFileSync(path.join(activityFolder, 'activities.csv'), csvContent);
    console.log(`Migrated ${activities.length} activities.`);
}
