app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:19006",

    // Render WEB actuel
    "https://web-bx1a.onrender.com",

    // futur domaine
    "https://assocmanager-web.onrender.com",

    // emergent preview
    "https://db-persistence-fix.preview.emergentagent.com"
  ],
  methods: ["GET","POST","PUT","DELETE","OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Association-Code"
  ],
  credentials: true
}));