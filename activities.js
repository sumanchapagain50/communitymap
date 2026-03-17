const activities = [
    {
        id: "act_1",
        name: "Health Post Rehabilitation",
        indicatorIds: ["H01", "F01"],
        communityIds: ["c_01", "c_02", "c_04", "c_03"],
        knowledgeGenerated: true,
        beneficiaries: { men: 120, women: 150, oldMen: 30, oldWomen: 45, newMen: 90, newWomen: 105 }
    },
    {
        id: "act_2",
        name: "Disaster Risk Training",
        indicatorIds: ["H02", "S01", "S02"],
        communityIds: ["c_11"],
        knowledgeGenerated: false,
        beneficiaries: { men: 50, women: 60, oldMen: 10, oldWomen: 15, newMen: 40, newWomen: 45 }
    },
    {
        id: "act_3",
        name: "Mangrove Reforestation",
        indicatorIds: ["N01", "N02"],
        communityIds: ["c_22", "c_31"],
        knowledgeGenerated: true,
        beneficiaries: { men: 200, women: 180, oldMen: 50, oldWomen: 40, newMen: 150, newWomen: 140 }
    },
    {
        id: "act_4",
        name: "Community Micro-finance Setup",
        indicatorIds: ["F01", "F02", "S01"],
        communityIds: ["comm_1", "comm_2"],
        knowledgeGenerated: false,
        beneficiaries: { men: 40, women: 300, oldMen: 10, oldWomen: 50, newMen: 30, newWomen: 250 }
    }
];
