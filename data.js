const staticData = {
    countries: [
        { name: "Nepal", center: [28.6549, 81.124], zoom: 10 }
    ],
    capitals: [
        { id: "human", name: "Human Capital", color: "#3B82F6", description: "Skills, knowledge, and health that enable people to work and pursue their goals. Includes education, health access, and labor productivity." },
        { id: "social", name: "Social Capital", color: "#10B981", description: "Networks, relationships, and trust that facilitate cooperation and collective action. Includes community groups, social safety nets, and governance." },
        { id: "physical", name: "Physical Capital", color: "#EF4444", description: "Basic infrastructure and producer goods needed to support livelihoods. Includes transportation, housing quality, water supply, and energy." },
        { id: "financial", name: "Financial Capital", color: "#F59E0B", description: "Financial resources that people use to achieve their livelihood objectives. Includes income stability, access to credit, and savings." },
        { id: "natural", name: "Natural Capital", color: "#8B5CF6", description: "Natural resource stocks and ecosystem services from which resource flows and services useful for livelihoods are derived. Includes land quality and resource management." }
    ],
    indicators: {
        financial: [
            { id: "F01", name: "Household access to discretionary funds", type: "Generic" },
            { id: "F02", name: "Community financial health", type: "Generic" },
            { id: "F03", name: "Local government financial capacity", type: "Generic" },
            { id: "F04", name: "Public infrastructure maintenance budget", type: "Generic" },
            { id: "F05", name: "Climate change adaptation planning and investment", type: "Generic" },
            { id: "F06", name: "Business continuity during floods", type: "Flood" },
            { id: "F07", name: "Business continuity during heatwave", type: "Heat" },
            { id: "F08", name: "Household income continuity during flood", type: "Flood" },
            { id: "F09", name: "Household income continuity during heatwave", type: "Heat" },
            { id: "F10", name: "Flood risk reduction investment", type: "Flood" },
            { id: "F11", name: "Heatwave risk reduction investment", type: "Heat" },
            { id: "F12", name: "Disaster insurance", type: "Generic" },
            { id: "F13", name: "Disaster recovery budget", type: "Generic" },
            { id: "F14", name: "Energy affordibility", type: "Generic" },
            { id: "F15", name: "Heatwave action-plan budget", type: "Heat" }
        ],
        human: [
            { id: "H01", name: "Secondary school attendance", type: "Generic" },
            { id: "H02", name: "Food availability", type: "Generic" },
            { id: "H03", name: "First aid knowledge", type: "Generic" },
            { id: "H04", name: "Awareness of the need for climate change action", type: "Generic" },
            { id: "H05", name: "Awarenss of climate change risk on floods", type: "Flood" },
            { id: "H06", name: "Awarenss of climate change risk on heatwaves", type: "Heat" },
            { id: "H07", name: "Awareness of how nature mitigates risk during floods", type: "Flood" },
            { id: "H08", name: "Awareness of how nature mitigates risk during heatwaves", type: "Heat" },
            { id: "H09", name: "Hazard exposure awareness", type: "Generic" },
            { id: "H10", name: "Hazard vulnerability awareness", type: "Generic" },
            { id: "H11", name: "Evacuation and safety knowledge", type: "Generic" },
            { id: "H12", name: "Unsafe water awareness", type: "Generic" },
            { id: "H13", name: "Heatwave protection knowledge", type: "Heat" },
            { id: "H14", name: "Worker protection for heatwaves", type: "Heat" }
        ],
        natural: [
            { id: "N01", name: "Tree cover", type: "Generic" },
            { id: "N02", name: "Permeable surfaces", type: "Generic" },
            { id: "N03", name: "Land use planning", type: "Generic" },
            { id: "N04", name: "Resource management", type: "Generic" },
            { id: "N05", name: "Land/water interface health", type: "Generic" },
            { id: "N06", name: "Ecological management for flood disaster risk reduction", type: "Flood" },
            { id: "N07", name: "Ecological management for heatwave disaster risk reduction", type: "Heat" }
        ],
        physical: [
            { id: "P01", name: "Energy supply continuity", type: "Generic" },
            { id: "P02", name: "Transportation system continuity", type: "Generic" },
            { id: "P03", name: "Communication systems continuity", type: "Generic" },
            { id: "P04", name: "Flood early warning", type: "Flood" },
            { id: "P05", name: "Heatwave early warning", type: "Heat" },
            { id: "P06", name: "Continuity of education during floods", type: "Flood" },
            { id: "P07", name: "Continuity of education during heatwaves", type: "Heat" },
            { id: "P08", name: "Emergency infrastructure and supplies during floods", type: "Flood" },
            { id: "P09", name: "Emergency infrastructure and supplies during heatwaves", type: "Heat" },
            { id: "P10", name: "Continuity of healthcare during disaster during floods", type: "Flood" },
            { id: "P11", name: "Continuity of healthcare during disaster during heatwaves", type: "Heat" },
            { id: "P12", name: "Forecasting for floods", type: "Flood" },
            { id: "P13", name: "Forecasting for heatwaves", type: "Heat" },
            { id: "P14", name: "Household protection and adaptation on floods", type: "Flood" },
            { id: "P15", name: "Household protection and adaptation on heatwaves", type: "Heat" },
            { id: "P16", name: "Availability of clean, safe water during floods", type: "Flood" },
            { id: "P17", name: "Availability of clean, safe water during heatwaves", type: "Heat" },
            { id: "P18", name: "Waste management and risk", type: "Generic" },
            { id: "P19", name: "Large scale flood protection", type: "Flood" }
        ],
        social: [
            { id: "S01", name: "Mutual support", type: "Generic" },
            { id: "S02", name: "Social inclusiveness of disaster risk management", type: "Generic" },
            { id: "S03", name: "Community safety", type: "Generic" },
            { id: "S04", name: "Local leadership", type: "Generic" },
            { id: "S05", name: "Disaster response personnel", type: "Generic" },
            { id: "S06", name: "Healthcare accessibility", type: "Generic" },
            { id: "S07", name: "Trust in local authorities", type: "Generic" },
            { id: "S08", name: "Intra-community equity", type: "Generic" },
            { id: "S09", name: "Inter-community equity", type: "Generic" },
            { id: "S10", name: "Risk reduction planning for floods", type: "Flood" },
            { id: "S11", name: "Risk reduction planning for heatwaves", type: "Heat" },
            { id: "S12", name: "Response planning for floods", type: "Flood" },
            { id: "S13", name: "Response planning for heatwaves", type: "Heat" },
            { id: "S14", name: "Family violence and response planning during floods", type: "Flood" },
            { id: "S15", name: "Family violence and response planning during heatwaves", type: "Heat" },
            { id: "S16", name: "Stakeholder engagement in risk management for floods", type: "Flood" },
            { id: "S17", name: "Stakeholder engagement in risk management for heatwaves", type: "Heat" },
            { id: "S18", name: "Flood risk mapping", type: "Flood" },
            { id: "S19", name: "Heatwave risk mapping", type: "Heat" },
            { id: "S20", name: "Flood disaster impact data collection and use", type: "Flood" },
            { id: "S21", name: "Heatwave disaster impact data collection and use", type: "Heat" }
        ]
    }
};

