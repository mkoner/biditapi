const express=require('express');
const cors=require('cors');
const multer=require('multer');
const knex=require('knex');
const bcrypt=require('bcrypt-nodejs');
const nodemailer = require('nodemailer');



const db=knex({
  client: 'pg',
  connection: {
    host : '127.0.0.1',
    user : 'postgres',
    password : 'mkoner',
    database : 'bidit'
  }
});

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'biditapp2020@gmail.com',
    pass: 'Bidit@2020' 
  }
});

const storage=multer.diskStorage({
	destination:function(req,file,cb){
		cb(null,'./uploads/');
	},
	filename:function(req,file,cb){
		cb(null,Date.now()+file.originalname );

	}
})
const fileFilter=(req,file,cb)=>{
	if(file.mimetype==='image/jpeg' || file.mimetype==='image/png' || file.mimetype==='application/pdf' || file.mimetype===	'application/msword'){
		cb(null,true);
	} else {
		cb(null,false);
	}
}
const upload=multer({
	storage:storage, 
	limits:{
	fileSize:1024*1024*10
},
fileFilter:fileFilter

});

const app=express();

app.use(express.json());
app.use(cors());
app.use('/uploads',express.static('uploads'));
 




app.get('/',(req,res)=>{
	res.send("it is working");
})
app.post('/adminsignin',(req,res)=>{
	db.select('*').from('admin').where(
		'email','=',req.body.email).then(
		data=>{
			if(data[0].password===req.body.password){
				res.json(data)
			}
			else{
				res.json("wrong credentials")
			}
			
		}).catch(err=>res.status(400).json("wrong credentials"))
})

app.post('/signin',(req,res)=>{
	db.select('email','hash').from('login').where(
		'email','=',req.body.email).then(
		data=>{
			const isValid=bcrypt.compareSync(req.body.password, data[0].hash);
			if(isValid){
				return db.select('*').from('users').where('email','=',req.body.email).then(
					user=>{
						res.json(user[0])
					}).catch(err=>res.status(400).json("user not found"))
			} else{
				res.status(400).json("wrong credentials")
			}
		}).catch(err=>res.status(400).json("wrong credentials"))
})


app.post('/register',(req,res)=>{
	const{name,email,password}=req.body;
	const hash = bcrypt.hashSync(password);
	db.transaction(trx=>{
		trx.insert({
			hash:hash,
			email:email
		}).into('login').returning('email').then(
		loginEmail=>{

		return trx('users').returning('*').insert({
    	name: name,
		email:loginEmail[0],
		joined: new Date()
    }).then(user=>{
    transporter.sendMail( {
  from: 'biditapp2020@gmail.com',
  to: email,
  subject: 'Welcome to BidIt',
  text: `Hi ${name} welcome to Bidit! Hope you are going to 
  enjoy your time with us.`
}, function(error, info){
  if (error) {
	console.log(error);
  } else {
    console.log('Email sent: ' + info.response);
  }
});
    	res.json(user[0])
    })
	  }).then(trx.commit).catch(trx.rollback)
	}).catch(err=>res.status(400).json("failled to register"))
})

app.get('/profile/:id',(req,res)=>{
	const {id}=req.params;
	db.select('*').from('users').where({id})
	.then(user=>{
		if(user.length){
			res.json(user[0])
		} else 
		res.status(400).json("user not found")
		
	}).catch(err=> res.status(400).json("no user found"))
			
})

app.put('/activate/:id',(req,res)=>{
	const {id}=req.params;
	db('item').where('id','=',id).update({
				status:'active'
		}).then(
		res.json('active')
		).catch(err=> res.status(400).json("no item found"))
			
})

app.delete('/delete/:id',(req,res)=>{
	const {id}=req.params;
	db('item').where('id','=',id).del().then(
		res.json('deleted')
		).catch(err=> res.status(400).json("no item found"))
			
})


app.get('/won/:user',(req,res)=>{
	const {user}=req.params;
	db.select('*').from('item').where('winner','=',user)
	.then(items=>{
		if(items.length){
			res.json(items)
		} else 
		res.json([])
		
	}).catch(err=> res.status(400).json(err))
			
})

app.get('/postedby/:user',(req,res)=>{
	const {user}=req.params;
	db.select('*').from('item').where('postedby','=',user)
	.then(items=>{
		if(items.length){
			res.json(items)
		} else 
		res.json([])
		
	}).catch(err=> res.status(400).json(err))
			
})



app.get('/notvalid/:id',(req,res)=>{
	const {id}=req.params;
	db('item').where('id','=',id).update({
		status:'notvalid'
	}).then(
	db.select('winner','postedby','name','emailed').from('item').where('id','=',id).then(name=>{
		if(!name[0].emailed){	
	 		db('item').where('id','=',id).update({
		emailed:true
	}).then(db.select('name','email').from('users').where('name','=',name[0].winner).clearOrder().unionAll(function() {
	  this.select('name','email').from('users').where('name','=',name[0].postedby)
	}).then( email=>{
		 transporter.sendMail( {
  from: 'biditapp2020@gmail.com',
  to: email[0].email,
  subject: 'bid won',
  text: `Congratulations ${name[0].winner}!
Your have won the item ${name[0].name} posted by ${name[0].postedby} on bid it.
 Please directly contact the concerned personne via this email ${email[1].email}.`
}, function(error, info){
  if (error) {
	console.log(error);
  } else {
    console.log('Email sent: ' + info.response);
  }
});

   transporter.sendMail( {
  from: 'biditapp2020@gmail.com',
  to: email[1].email,
  subject: 'Auction completed',
  text: `Hi ${name[0].postedby}!
The item ${name[0].name} you posted on Bidit has been won by ${name[0].winner}
 Please directy contact the concerned personne via this email ${email[0].email}.`
}, function(error, info){
  if (error) {
	console.log(error);
  } else {
    console.log('Email sent: ' + info.response);
  }
});
}))}
		res.json("updated")
	})
	
	).catch(err=> res.status(400).json(err))
})

app.put('/bid',(req,res)=>{
	const {uid,iid,bid}=req.body;
	const od1=1;
	const od2=2;
	var arr=[];
	
db.select('name','winningbid').from('item').where('id','=',iid).clearOrder().unionAll(function() {
  this.select('name','id').from('users').where('id','=',uid)
}).then(data=>{ 
	if(data[0].winningbid<bid){
		db('item').where('id','=',iid).update({
				winningbid:bid,
				winner:data[1].name
		}).then(
			db('users').where('id','=',uid).increment('bids',1).returning('bids').then(bids=>{
			res.json("success")
		})).catch(err=> res.status(400).json("item not found"))
	}else{
			res.json('less')
		} 

}).catch(err=> console.log(err))

	
})
  






app.post('/postitem',upload.fields([{
           name: 'itemImage', maxCount: 1
         }, {
           name: 'itemProof', maxCount: 1
         }]),(req,res)=>{
	const{name,endtime,description,user}=req.body;
	console.log(req.files)
	const itemImage=req.files.itemImage[0].path;
	const itemProof=req.files.itemProof[0].path;
	db('item').returning('*').insert({
		name:name,
		enddate:endtime,
		winningbid:0,
		description:description,
		img:'http://localhost:3005/'+itemImage,
		proof:'http://localhost:3005/'+itemProof,
		postedby:user,
		status:'pending'

	}).then(product=>{
		db.select('email').from('users').where('name','=',user).then( email=> {
	transporter.sendMail( {
  from: 'biditapp2020@gmail.com',
  to: 'mdoukoner@gmail.com',
  subject: 'New Item posted',
  text: `Hi Mkoner
   ${user} has posted a new Item called ${name}. Please login to the admin panel to validate.`
}, function(error, info){
  if (error) {
	console.log(error);
  } else {
    console.log('Email sent: ' + info.response);
  }
});

	transporter.sendMail( {
  from: 'biditapp2020@gmail.com',
  to: email[0].email,
  subject: 'New Item posted',
  text: `Dear ${user}
We have received a request from your side to post a new Item called ${name}. Our Admin Will examine the request shortly.
Thank you for using BidIt`
}, function(error, info){
  if (error) {
	console.log(error);
  } else { 
    console.log('Email sent: ' + info.response);
  }
});
					} )
	res.json(product)
	}).catch(err=> res.status(400).json(err)) 

})


app.post('/updateiteminfo',upload.single('itemImage'),(req,res)=>{
	const{id,endtime,description}=req.body;
	if(!req.file)
	{var itemImage=null}
  if(req.file)
	{var itemImage=req.file.path}
  const sta="active"
  

	if(endtime&&description&&itemImage)
	{db('item').where('id','=',id).update({
	 		enddate:endtime,
	 		description:description,
	 		img:'http://localhost:3005/'+itemImage,
	 		status:sta
	 	}).then(product=>{
	 		res.json(product)
	 	}).catch(err=> res.status(400).json(err))} 

	 	else if(endtime&&description)
	{db('item').where('id','=',id).update({
	 		enddate:endtime,
	 		description:description,
	 		status:sta
	 	}).then(product=>{
	 		res.json(product)
	 	}).catch(err=> res.status(400).json(err))} 
	 	else if(endtime&&itemImage)
	{db('item').where('id','=',id).update({
	 		enddate:endtime,
	 		description:description,
	 		status:sta
	 	}).then(product=>{
	 		res.json(product)
	 	}).catch(err=> res.status(400).json(err))} 
	   else if(description&&itemImage)
	{db('item').where('id','=',id).update({
	 		description:description,
	 		img:'http://localhost:3005/'+itemImage,
	 		status:sta
	 	}).then(product=>{
	 		res.json(product)
	 	}).catch(err=> res.status(400).json(err))} 

	 	else if(endtime)
	{db('item').where('id','=',id).update({
	 		enddate:endtime,
	 		status:sta
	 	}).then(product=>{
	 		res.json(product)
	 	}).catch(err=> res.status(400).json(err))} 
	 	else if(description)
	{db('item').where('id','=',id).update({
	 		status:sta,
	 		description:description
	 	}).then(product=>{
	 		res.json(product)
	 	}).catch(err=> res.status(400).json(err))} 
	 	else if(itemImage)
	{db('item').where('id','=',id).update({
	 		img:'http://localhost:3005/'+itemImage,
	 		status:sta
	 	}).then(product=>{
	 		res.json(product)
	 	}).catch(err=> res.status(400).json(err))} 

})

app.get('/items',(req,res)=>{
db.select('*').from('item').then(data=>{

	const itemx=data.map(item=>{
	var time = new Date(item.enddate).getTime();
  	var now = new Date().getTime();
  	var t = time-now;
  	
  item.secondes = Math.floor( (t/1000) % 60 );
  item.minutes = Math.floor( (t/1000/60) % 60 );
 item.hours = Math.floor( (t/(1000*60*60)) % 24 );
 item.days = Math.floor( t/(1000*60*60*24) );
  if(t<=0){
  item.status="notvalid"
 }
 return item
  })
 res.json(itemx)
}).catch(err=> res.status(400).json('unable to get items')) 
})

app.get('/solditems',(req,res)=>{
	db.select('*').from('item').where('status','=','notvalid').clearOrder().then(
		data=>res.json(data)).catch(err=> res.status(400).json('unable to get items')) 
})


app.get('/pendingitems',(req,res)=>{
	db.select('*').from('item').where('status','=','pending').then(
		data=>res.json(data)).catch(err=> res.status(400).json('unable to get items')) 

})

app.get('/activeitems',(req,res)=>{
	db.select('*').from('item').where('status','=','active').then(
		data=>
       {const itemx=data.map(item=>{
       	var time = new Date(item.enddate).getTime();
         	var now = new Date().getTime();
         	var t = time-now;
         	
         item.secondes = Math.floor( (t/1000) % 60 );
         item.minutes = Math.floor( (t/1000/60) % 60 );
        item.hours = Math.floor( (t/(1000*60*60)) % 24 );
        item.days = Math.floor( t/(1000*60*60*24) );
         if(t<=0){
         item.status="notvalid"
        }
        return item
         })
        res.json(itemx)}).catch(err=> res.status(400).json('unable to get items')) 
})
app.get('/users',(req,res)=>{
	db.select('*').from('users').then(
		data=>res.json(data)).catch(err=> res.status(400).json('unable to get users')) 
})

app.listen(process.env.PORT||3005,()=>{
	console.log(`server running on port ${process.env.PORT}`)
});

