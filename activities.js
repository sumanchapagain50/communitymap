const activitiesDataStatic = [
    {
        id: "act_01",
        name: "Community Health Post Rehabilitation",
        year: 2024,
        quarter: "Q1",
        indicatorIds: ["H03", "P10", "P11"],
        communityIds: ["c_01", "c_02", "c_03"],
        knowledgeGenerated: true,
        beneficiaries: { men: 120, women: 150, oldMen: 30, oldWomen: 45, newMen: 90, newWomen: 105 }
    },
    {
        id: "act_02",
        name: "Flood Disaster Risk Training",
        year: 2024,
        quarter: "Q1",
        indicatorIds: ["H05", "H09", "S10", "S12"],
        communityIds: ["c_01", "c_04", "c_10"],
        knowledgeGenerated: true,
        beneficiaries: { men: 50, women: 60, oldMen: 10, oldWomen: 15, newMen: 40, newWomen: 45 }
    },
    {
        id: "act_03",
        name: "Mangrove and Riparian Reforestation",
        year: 2024,
        quarter: "Q1",
        indicatorIds: ["N01", "N06", "N05"],
        communityIds: ["c_02", "c_05", "c_06"],
        knowledgeGenerated: true,
        beneficiaries: { men: 200, women: 180, oldMen: 50, oldWomen: 40, newMen: 150, newWomen: 140 }
    },
    {
        id: "act_04",
        name: "Community Micro-finance and Savings Group",
        year: 2024,
        quarter: "Q1",
        indicatorIds: ["F01", "F02", "S01"],
        communityIds: ["c_01", "c_02", "c_07", "c_08"],
        knowledgeGenerated: false,
        beneficiaries: { men: 40, women: 300, oldMen: 10, oldWomen: 50, newMen: 30, newWomen: 250 }
    },
    {
        id: "act_05",
        name: "Flood Early Warning System Installation",
        year: 2024,
        quarter: "Q1",
        indicatorIds: ["P04", "P12", "S10"],
        communityIds: ["c_03", "c_09", "c_10", "c_11"],
        knowledgeGenerated: true,
        beneficiaries: { men: 80, women: 70, oldMen: 20, oldWomen: 15, newMen: 60, newWomen: 55 }
    },
    {
        id: "act_06",
        name: "Heatwave Awareness and Protection Campaign",
        year: 2024,
        quarter: "Q1",
        indicatorIds: ["H06", "H13", "H14", "P05"],
        communityIds: ["c_04", "c_12", "c_13"],
        knowledgeGenerated: true,
        beneficiaries: { men: 110, women: 130, oldMen: 25, oldWomen: 30, newMen: 85, newWomen: 100 }
    },
    {
        id: "act_07",
        name: "Women-Led Disaster Response Group",
        year: 2024,
        quarter: "Q1",
        indicatorIds: ["S02", "S05", "S12", "S14"],
        communityIds: ["c_05", "c_14", "c_15"],
        knowledgeGenerated: false,
        beneficiaries: { men: 20, women: 180, oldMen: 5, oldWomen: 40, newMen: 15, newWomen: 140 }
    },
    {
        id: "act_08",
        name: "Water Source Protection and WASH Training",
        year: 2024,
        quarter: "Q1",
        indicatorIds: ["H12", "P16", "N05"],
        communityIds: ["c_06", "c_16", "c_17"],
        knowledgeGenerated: true,
        beneficiaries: { men: 90, women: 110, oldMen: 20, oldWomen: 25, newMen: 70, newWomen: 85 }
    },
    {
        id: "act_09",
        name: "Local Governance and Leadership Strengthening",
        year: 2024,
        quarter: "Q1",
        indicatorIds: ["S04", "S07", "F03"],
        communityIds: ["c_07", "c_18", "c_19", "c_20"],
        knowledgeGenerated: false,
        beneficiaries: { men: 60, women: 50, oldMen: 15, oldWomen: 10, newMen: 45, newWomen: 40 }
    },
    {
        id: "act_10",
        name: "Household Flood Protection and Adaptation",
        year: 2024,
        quarter: "Q1",
        indicatorIds: ["P14", "P08", "F08"],
        communityIds: ["c_08", "c_21", "c_22"],
        knowledgeGenerated: true,
        beneficiaries: { men: 75, women: 85, oldMen: 15, oldWomen: 20, newMen: 60, newWomen: 65 }
    },
    {
        id: "act_11",
        name: "Heatwave Early Warning and Cooling Infrastructure",
        year: 2024,
        quarter: "Q1",
        indicatorIds: ["P05", "P09", "P13"],
        communityIds: ["c_09", "c_23", "c_24"],
        knowledgeGenerated: true,
        beneficiaries: { men: 95, women: 105, oldMen: 20, oldWomen: 25, newMen: 75, newWomen: 80 }
    },
    {
        id: "act_12",
        name: "Land Use and Livelihood Mapping",
        year: 2024,
        quarter: "Q1",
        indicatorIds: ["N03", "N04", "F05"],
        communityIds: ["c_10", "c_25", "c_26"],
        knowledgeGenerated: true,
        beneficiaries: { men: 55, women: 45, oldMen: 10, oldWomen: 8, newMen: 45, newWomen: 37 }
    },
    {
        id: "act_13",
        name: "Climate Smart Agriculture Training",
        year: 2024,
        quarter: "Q1",
        indicatorIds: ["N04", "F01", "H04"],
        communityIds: ["c_11", "c_27", "c_28", "c_29"],
        knowledgeGenerated: false,
        beneficiaries: { men: 130, women: 120, oldMen: 30, oldWomen: 25, newMen: 100, newWomen: 95 }
    },
    {
        id: "act_14",
        name: "First Aid and Emergency Response Training",
        year: 2024,
        quarter: "Q1",
        indicatorIds: ["H03", "H11", "S05"],
        communityIds: ["c_12", "c_30", "c_31"],
        knowledgeGenerated: true,
        beneficiaries: { men: 85, women: 95, oldMen: 15, oldWomen: 20, newMen: 70, newWomen: 75 }
    },
    {
        id: "act_15",
        name: "Community Disaster Risk Fund Establishment",
        year: 2024,
        quarter: "Q1",
        indicatorIds: ["F12", "F13", "F10"],
        communityIds: ["c_13", "c_32", "c_33"],
        knowledgeGenerated: false,
        beneficiaries: { men: 45, women: 55, oldMen: 10, oldWomen: 12, newMen: 35, newWomen: 43 }
    },
    {
        id: "act_16",
        name: "Flood Risk Mapping and Community Planning",
        year: 2024,
        quarter: "Q1",
        indicatorIds: ["S18", "S10", "N06"],
        communityIds: ["c_14", "c_34", "c_35"],
        knowledgeGenerated: true,
        beneficiaries: { men: 70, women: 60, oldMen: 15, oldWomen: 12, newMen: 55, newWomen: 48 }
    },
    {
        id: "act_17",
        name: "Social Inclusiveness and Equity in DRM",
        year: 2024,
        quarter: "Q1",
        indicatorIds: ["S02", "S08", "S09"],
        communityIds: ["c_15", "c_36", "c_37"],
        knowledgeGenerated: false,
        beneficiaries: { men: 60, women: 90, oldMen: 15, oldWomen: 20, newMen: 45, newWomen: 70 }
    },
    {
        id: "act_18",
        name: "Evacuation Route Planning and Drills",
        year: 2024,
        quarter: "Q1",
        indicatorIds: ["H11", "S12", "P02"],
        communityIds: ["c_16", "c_38", "c_39"],
        knowledgeGenerated: true,
        beneficiaries: { men: 100, women: 110, oldMen: 20, oldWomen: 25, newMen: 80, newWomen: 85 }
    },
    {
        id: "act_19",
        name: "Healthcare Continuity during Disasters",
        year: 2024,
        quarter: "Q1",
        indicatorIds: ["P10", "P11", "S06"],
        communityIds: ["c_17", "c_40", "c_41"],
        knowledgeGenerated: false,
        beneficiaries: { men: 65, women: 75, oldMen: 15, oldWomen: 18, newMen: 50, newWomen: 57 }
    },
    {
        id: "act_20",
        name: "Energy Resilience and Solar Installation",
        year: 2024,
        quarter: "Q1",
        indicatorIds: ["P01", "F14"],
        communityIds: ["c_18", "c_42", "c_43"],
        knowledgeGenerated: false,
        beneficiaries: { men: 55, women: 45, oldMen: 10, oldWomen: 8, newMen: 45, newWomen: 37 }
    },
    {
        id: "act_21",
        name: "Heatwave Risk Mapping and Planning",
        year: 2024,
        quarter: "Q1",
        indicatorIds: ["S19", "S11", "H13"],
        communityIds: ["c_19", "c_44", "c_45"],
        knowledgeGenerated: true,
        beneficiaries: { men: 80, women: 100, oldMen: 18, oldWomen: 22, newMen: 62, newWomen: 78 }
    },
    {
        id: "act_22",
        name: "Communication Systems for Disaster Response",
        year: 2024,
        quarter: "Q1",
        indicatorIds: ["P03", "S05", "P04"],
        communityIds: ["c_20", "c_46", "c_47"],
        knowledgeGenerated: false,
        beneficiaries: { men: 70, women: 60, oldMen: 12, oldWomen: 10, newMen: 58, newWomen: 50 }
    },
    {
        id: "act_23",
        name: "Waste Management and Flood Risk Reduction",
        year: 2024,
        quarter: "Q1",
        indicatorIds: ["P18", "P19", "N02"],
        communityIds: ["c_21", "c_48", "c_49"],
        knowledgeGenerated: true,
        beneficiaries: { men: 90, women: 80, oldMen: 20, oldWomen: 15, newMen: 70, newWomen: 65 }
    },
    {
        id: "act_24",
        name: "Family Violence Prevention in Disasters",
        year: 2024,
        quarter: "Q1",
        indicatorIds: ["S14", "S15", "S02"],
        communityIds: ["c_22", "c_50", "c_51"],
        knowledgeGenerated: false,
        beneficiaries: { men: 30, women: 140, oldMen: 5, oldWomen: 30, newMen: 25, newWomen: 110 }
    },
    {
        id: "act_25",
        name: "Heatwave Impact Data collection and Use",
        year: 2024,
        quarter: "Q1",
        indicatorIds: ["S21", "S19", "H06"],
        communityIds: ["c_23", "c_52", "c_53"],
        knowledgeGenerated: true,
        beneficiaries: { men: 65, women: 75, oldMen: 12, oldWomen: 18, newMen: 53, newWomen: 57 }
    },
    {
        id: "act_26",
        name: "Flood Impact Data collection and Use",
        year: 2024,
        quarter: "Q1",
        indicatorIds: ["S20", "S18", "P12"],
        communityIds: ["c_24", "c_54", "c_55"],
        knowledgeGenerated: true,
        beneficiaries: { men: 70, women: 80, oldMen: 14, oldWomen: 18, newMen: 56, newWomen: 62 }
    },
    {
        id: "act_27",
        name: "Stakeholder Engagement in Flood DRM",
        year: 2024,
        quarter: "Q1",
        indicatorIds: ["S16", "S04", "F03"],
        communityIds: ["c_25", "c_56", "c_57"],
        knowledgeGenerated: false,
        beneficiaries: { men: 55, women: 50, oldMen: 12, oldWomen: 10, newMen: 43, newWomen: 40 }
    },
    {
        id: "act_28",
        name: "Heatwave Stakeholder and Policy Engagement",
        year: 2024,
        quarter: "Q1",
        indicatorIds: ["S17", "S11", "F11"],
        communityIds: ["c_26", "c_01", "c_05"],
        knowledgeGenerated: false,
        beneficiaries: { men: 60, women: 55, oldMen: 12, oldWomen: 10, newMen: 48, newWomen: 45 }
    },
    {
        id: "act_29",
        name: "Food Security and Nutrition Programme",
        year: 2024,
        quarter: "Q1",
        indicatorIds: ["H02", "F01", "S01"],
        communityIds: ["c_27", "c_10", "c_15"],
        knowledgeGenerated: false,
        beneficiaries: { men: 110, women: 130, oldMen: 25, oldWomen: 28, newMen: 85, newWomen: 102 }
    },
    {
        id: "act_30",
        name: "Secondary Education Continuity",
        year: 2024,
        quarter: "Q1",
        indicatorIds: ["H01", "P06", "P07"],
        communityIds: ["c_28", "c_20", "c_30"],
        knowledgeGenerated: true,
        beneficiaries: { men: 95, women: 105, oldMen: 15, oldWomen: 20, newMen: 80, newWomen: 85 }
    }
];
