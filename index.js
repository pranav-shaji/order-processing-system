import dotenv from 'dotenv';
dotenv.config();
import express from "express";
import dbconnect from "./dbconnect.js";
dbconnect();
const app = express();
// Middleware to parse form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const port = 5000;

//routes
import routes from "./routes.js";
//collection names
app.use("/order", routes);

app.get("/", (req, res) => {
  res.send("hello from automated server");
});

app.listen(port, () => {
  console.log(`server running on ${port}`);
});
