app.get("/products",async (req,res)=>{
    try{
  const page=Number(req.query.page)
  const limit=Number(req.query.limit)

  const total=await product.countDocuments()
  const totalPage= Math.max(1,Math.ceil(total/limit))
  
const currentPage=Math.min(page,totalPage)

const skip=(currentPage-1)*limit;
const Products=await product.find().skip(skip).limit(limit).lean()
    }
    catch{
        return res.status(400).json({
            sucess:false,
            message:"Pagination Failed"
        })
    }
})