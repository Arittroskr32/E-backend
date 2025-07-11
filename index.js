const port= 4000;
const express = require("express");
const app= express();
const mongoose= require("mongoose");
const jwt= require("jsonwebtoken");
const multer= require("multer");
const path= require("path");
const cors= require("cors");


app.use(express.json());
app.use(cors());

// database connection 

// mongoose.connect("mongodb://127.0.0.1:27017/e-commerce");
const dbConnection = () => {
    mongoose.connect("mongodb://127.0.0.1:27017/E_Commerce").then(()=>{
        console.log("Connected to MongoDB yes");
    }).catch((err)=>{
        console.log(`Some error in database: ${err}`)
    })
};


//API creation
app.get("/",(req,res)=>{
    res.send("Express app running");
})

// Image storage engine using multer
const storage = multer.diskStorage({
    destination: "./upload/images",
    filename:(req,file,cb)=>{
        return cb(null,`${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`)
    }
})

const upload= multer({storage:storage})


//creating upload endpoint for images
app.use("/images",express.static("upload/images"))

app.post("/upload", upload.single("product"),(req,res)=>{
    res.json({
        success:1,
        image_url: `http://localhost:${port}/images/${req.file.filename}`
    })
})

// Schema for creating products
const Productschema = new mongoose.Schema({
    id:{
        type:Number,
        required:true,
    },
    name:{
        type:String,
        required:true,
    },
    image:{
        type:String,
        required:true,
    },
    category:{
        type:String,
        required:true,
    },
    new_price:{
        type:Number,
        required:true
    },
    old_price:{
        type:Number,
        required:true
    },
    date:{
        type:Date,
        default:Date.now,
    },
    available:{
        type:Boolean,
        default:true,
    }
})
//model creation functions
const Product = new mongoose.model('Product', Productschema);

//creating api for adding products
app.post("/addproduct",async(req,res)=>{
    let products= await Product.find({});
    let id;
    if(products.length>0){
        let last_product_array = products.slice(-1);
        let last_product = last_product_array[0];
        id= last_product.id+1;
    }
    else{
        id=1;
    }

    const product = new Product({
        id: id,
        name:req.body.name,
        image:req.body.image,
        category:req.body.category,
        new_price:req.body.new_price,
        old_price:req.body.old_price
    });
    await product.save();
    console.log("Product saved!!!");
    res.json({
        success:true,
        name: req.body.name,
    })
})

//creating api for deleting products
app.post("/removeproduct", async(req,res)=>{
    await Product.findOneAndDelete({id:req.body.id});
    console.log("Product removed");
    res.json({
        success:true,
        name:req.body.name
    })
})

//Creating API for getting all products
app.get("/allproducts", async(req,res)=>{
    let products = await Product.find({});
    console.log("All Product Fetched");
    res.send(products);
})

//schema for user interface
const Userschema = mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email:{
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    cartData:{
        type: Object
    },
    date: {
        type: Date,
        default: Date.now,
    }
})

const User = new mongoose.model("User",Userschema)


//creating API for registering users
app.post("/signup", async(req,res)=>{
    let check = await User.findOne({email : req.body.email});
    if(check){
        return res.status(400).json({
            success: false,
            error: "Existing User found with same email address"
        })
    }

    let cart = {};
    for (let i = 0; i < 300; i++) {
        cart[i]=0;
    }
    const user = new User({
        name: req.body.username,
        email: req.body.email,
        password: req.body.password,
        cartData: cart
    })

    await user.save();
    const data = {
        user : {
            id: user.id,
        }
    }
    const token = jwt.sign(data,'secreat_ecom');
    res.json({
        success: true,
        message:"User saved!!!",
        token,
    })
})

//creating API for login users
app.post("/login", async (req, res) =>{
    let user = await User.findOne({email:req.body.email});
    if(user){
        const passCompare = req.body.password=== user.password;
        if(passCompare){
            const data= {
                user:{ id: user.id }
            }
            const token = jwt.sign(data,'secreat_ecom');
            res.json({
                success: true,
                message:"User logged in successfully",
                token,
            })
        }
        else{
            res.json({
                success: false,
                error: "Password does not match"
            })
        }
    }
    else{
        res.json({
            success: false,
            error: "User not found with this email address"
        })
    }
})


// creating API for new collection data
app.get("/newcollection", async (req, res) =>{
    let products = await Product.find({});
    let new_collection = products.slice(1).slice(-8);
    res.send(new_collection);
})

// creating API for popular in women collection
app.get("/popularinwomen", async (req, res) =>{
    let products = await Product.find({category: "women"});
    let popular_in_women = products.slice(0,4);
    res.send(popular_in_women);
})

//creating middleware for fetch user information
const fetchUser = async (req, res,next) =>{
    const token = req.header('auth-token');
    if(!token){
        res.status(401).send({errors: "Please authorized"});
    }
    else{
        try {
            const data = jwt.verify(token,'secreat_ecom')
            req.user = data.user;
            next()
        } catch (error) {
            res.status(401).send({error:"please authorized by user"})
        }
    }
}


// creating API for add to Cart
app.post("/addtocart", fetchUser ,async(req,res)=>{
    let userData = await User.findOne({_id: req.user.id})
    userData.cartData[req.body.itemId] +=1 ;
    await User.findOneAndUpdate({_id: req.user.id}, {cartData: userData.cartData})
})

//creating api for remove cartdata
app.post("/removefromcart", fetchUser , async(req,res)=>{
    let userData = await User.findOne({_id: req.user.id})
    if(userData.cartData[req.body.itemId]>0)userData.cartData[req.body.itemId] -=1 ;
    await User.findOneAndUpdate({_id: req.user.id}, {cartData: userData.cartData})
})

//creating api for get cart data
app.post("/getcart", fetchUser, async(req,res)=>{
    let userData = await User.findOne({_id: req.user.id})
    res.json(userData.cartData);
})

app.listen(port,(err)=>{
    if(!err){
        console.log("server running on port " +port );
    }
    else{
        console.log("Error : "+err);
    }
})

dbConnection();