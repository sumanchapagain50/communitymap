var countries = [
  {
    name: "Nepal",
    lat: 28.3949,
    lng: 84.1240,
    communities: [
      { 
        name: "Community A", 
        lat: 28.45, 
        lng: 81.12, 
        hazards: ["heatwave", "flood"],  // ← updated: multiple hazards
        demographic: {population: 600, households: 120, schools: 5},
        scores: {resilience: 75},
        activities: [
          {title: "Tree Planting", details: "Planted 500 trees", photo: "treeplanting1.jpg"},
          {title: "Flood Awareness", details: "Community training", photo: "flood1.jpg"}
        ]
      },
      { 
        name: "Community B", 
        lat: 28.50, 
        lng: 81.20, 
        hazards: ["heatwave"],  // single hazard (array format)
        demographic: {population: 300, households: 70, schools: 2},
        scores: {resilience: 60},
        activities: [
          {title: "Water Supply Improvement", details: "Installed water tanks", photo: "water1.jpg"}
        ]
      }
    ]
  },
  {
    name: "Bangladesh",
    lat: 23.6850,
    lng: 90.3563,
    communities: [
      { 
        name: "Community X", 
        lat: 23.70, 
        lng: 90.35, 
        hazards: ["heatwave", "flood","drought"],
        demographic: {population: 900, male: 500, female: 400, households: 200, schools: 8},
        scores: {resilience: 80},
        activities: [
          {title: "Flood Drill", details: "Community flood drill", photo: "flood2.jpg"}
        ]
      }
    ]
  }
];