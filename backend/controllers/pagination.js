//name,parent,islisted
import Category from "../models/Category"
import express from "express"
const app=express()
app.use(express.json())
app.post("/category/add",async (req,res)=>{
    try{
      const {name,parentId,isListed}=req.body
      const nameKey=name.toLowerCase()
      const duplicate=nameKey.exists({})
      if(duplicate){
  return res.status(400).json({
    sucess:false,
    message:"category name already exists"
  })
      }

    
      
    const category=new Category({
    name,
    nameKey,
    parent:parentId||null,
    isListed,
    })
    await category.save()
return res.status(200).json({
    sucess:false,
    message:category
})


    }
    catch{
        res.status(400).json({
            sucess:false,
            message:"category added failed"
        })
    }
})