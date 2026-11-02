import connectDB from "./config/db.js"
import mongoose from "mongoose";
import "dotenv/config"
import createApp from "./app.js"

const port=Number(process.env.PORT) || 5000;
export default async function startServer(){
 try{
await connectDB();
const app=createApp()
const server=app.listen(port,()=>{
  console.log(`server running sucessfully on port ${port}`)
})
server.on("error",async (error)=>{
  console.error("error occured.reason is:"+error.message);
  process.exitCode = 1;
 await mongoose.disconnect()
})
  }catch(error){
 console.error("error occured.reason is:"+error.message)
 process.exitCode = 1;
 await mongoose.disconnect()
  }
}
await startServer();