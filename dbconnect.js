import mongoose from "mongoose";


  let dbconnect = () => {
    try {
        mongoose.connect(
          process.env.DBLINK
          
        );
        console.log("database connected to the portal");
        
        
    } catch (error) {
        console.log(error);
    }
  };
  
  

export default dbconnect;