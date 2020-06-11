const express = require('express')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')

const mongo = require('mongodb')
const MongoClient = mongo.MongoClient;
const uri = "mongodb+srv://clarkjoe:Granados4@cluster0-lqmal.mongodb.net/<dbname>?retryWrites=true&w=majority";
const dbClient = new MongoClient(uri, { useNewUrlParser: true });
// client.connect(err => {
//   const collection = client.db("test").collection("devices");
//   // perform actions on the collection object
//   client.close();
// });

const app = express()
const port = 3000

app.use(cookieParser())

app.use(bodyParser.urlencoded({extended:false}))
app.use(bodyParser.json())

// pug setup
app.set('views', 'src/views')
app.set('view engine', 'pug')

// fake data
const fakeData = {
    creditCards: [
        {
            name: 'Wells Fargo Propel',
            categories: [
                { name: 'Gas', multiplier: 3 },
                { name: 'Travel', multiplier: 3 },
                { name: 'Dining out', multiplier: 3 },
                { name: 'Take out', multiplier: 3 },
                { name: 'Other', multiplier: 1 }
            ]
        },
        {
            name: 'Chase Sapphire Reserve',
            categories: [
                { name: 'Lyft rides', multiplier: 10 },
                { name: 'DoorDash', multiplier: 5 },
                { name: 'Tock', multiplier: 5 },
                { name: 'Grocery Stores', multiplier: 5 },
                { name: 'Travel', multiplier: 3 },
                { name: 'Dining out', multiplier: 3 },
                { name: 'Take out', multiplier: 3 },
                { name: 'Other', multiplier: 1 }
            ]
        },
        {
            name: 'Chase Freedom',
            categories: [
                { name: 'Lyft rides', multiplier: 5 },
                { name: 'DoorDash', multiplier: 5 },
                { name: 'Tock', multiplier: 5 },
                { name: 'Grocery Stores', multiplier: 5 },
                { name: 'Gym Memberships', multiplier: 5 },
                { name: 'Streaming Services', multiplier: 5 },
                { name: 'Other', multiplier: 1 }
            ]
        },
        {
            name: 'Chase Freedom Unlimited',
            categories: [
                { name: 'Lyft rides', multiplier: 5 },
                { name: 'DoorDash', multiplier: 5 },
                { name: 'Tock', multiplier: 5 },
                { name: 'Other', multiplier: 1.5 }
            ]
        }
    ]
}

app.get('/', (req, res) => {
  res.render('index', { title: 'Max_Points', app_name: 'Max Points' })
})

app.post('/login', (req, res, next) => {
    // ensure username and password are correct
    const username = req.body.username 
    const password = req.body.password
    
    dbClient.connect((err, client) => {
        if (err) {
            console.log(err);
            console.log("error connecting");
            next(err)
        }
        console.log("successfully connected to db");
        const collection = client.db("max_points").collection("customer");
        collection.find({username: username, password: password}).toArray((err, docs) => {
            if (err) {
                next(err)
                client.close();
            }
            if (docs === null) {
                next("error")
                client.close();
            }
            if (docs.length != 1) {
                res.render('index', { error: 'Incorrect username or password. Please try again.', title: 'Max_Points', app_name: 'Max Points' })
                return
            } else {
                const fname = docs[0].fname
                var cardObjectIDs = []
                
                for (cardId of docs[0].cards) {
                    var o_id = mongo.ObjectID(cardId)
                    cardObjectIDs.push(o_id)
                }
                const cardCollection = client.db("max_points").collection("card");
                cardCollection.find({_id: {"$in": cardObjectIDs}}).toArray((err, cards) => {
                    if (err) {
                        next(err)
                        client.close();
                    }
                    var creditCardData = {}
                    for (card of cards) {
                        const card_name = card.name
                        const categories = card.categories
                        
                        if (!creditCardData.hasOwnProperty(card_name)) {
                            creditCardData[card_name] = {categories: []}
                        }
                        
                        for (let [category_name, category_multiplier] of Object.entries(categories)) {
                            creditCardData[card_name].categories.push({name: category_name, multiplier: category_multiplier})
                        }
                    }

                    res.render('userCards', { creditCards: creditCardData, fname: fname, username: username, app_name: 'Max Points'})
                    client.close();
                })
            }
        });
    });
})

app.post('/register', (req, res, next) => {
    const username = req.body.username 
    const password = req.body.password
    const fname = req.body.fname
    const lname = req.body.lname
    
    if (fname === "" || lname === "", username === "" || password === "") {
        res.render('index', { error: 'Please add a username, password, first and last name', title: 'Max_Points', app_name: 'Max Points' })
        next()
        return
    }
    
    // ensure username does not already exist
    dbClient.connect((err, client) => {
        if (err) {
            console.log(err);
            console.log("error connecting");
            next(err)
        }
        console.log("successfully connected to db");
        const collection = client.db("max_points").collection("customer");
        collection.findOne({username: username}, (err, findOneRes) => {
            if (err) {
                next(err)
                client.close()
            }
            if (findOneRes) {
                res.render('index', { error: 'Username already exists. Please try a different username', title: 'Max_Points', app_name: 'Max Points' })
                return
            } else {
                collection.insertOne({username: username, fname: fname, lname: lname, password: password, cards: []}, (err, insertOneRes) => {
                    if (err) {
                        next(err)
                        client.close()
                    }
                    var creditCardData = {}
                    res.render('userCards', { creditCards: creditCardData, fname: fname, username: username, app_name: 'Max Points'})
                    client.close();
                })
            }
        });
    });
})

app.get('/cards', (req, res) => {
    // return information about all credit cards
    res.render('cards', { creditCards: fakeData['creditCards'], app_name: 'Max Points'})
})

app.post('/addcard', (req, res, next) => {
    const card_name = req.body.cardname
    const username = req.body.username
    const fname = req.body.fname
    
    // get customerID
    const select_customer = `SELECT customerID FROM customer WHERE customer.username = '${username}';`
    
    dbClient.connect((err, client) => {
        if (err) {
            next(err)
            client.close()
            return
        }
        console.log("successfully connected to DB");
        
        const collection = client.db("max_points").collection("customer");
        // const cardCollection = client.db("max_points").collection("card");
        
        console.log(card_name);
        
        collection.findOne({username: username}, (err, customer) => {
            if (err) {
                next(err)
                client.close()
                return
            }
            else {
                res.send(customer)
                client.close()
            }
            // const fname = customer.fname
            // var cardObjectIDs = []
            // 
            // for (cardId of customer.cards) {
            //     var o_id = mongo.ObjectID(cardId)
            //     cardObjectIDs.push(o_id)
            // }
            // const cardCollection = dbClient.db("max_points").collection("card");
        })
        
        // cardCollection.findOne({name: card_name}, (err, card) => {
        //     if (err) {
        //         client.close()
        //         next(err)
        //     } else {
        //         client.close()
        //         res.send(card)                
        //     }
        // })
    })
    
    // dbClient.query(select_customer,(err, customerIDs) => {
    //   if(err) {
    //       next(err)
    //   } else {
    //       const customerID = customerIDs.rows[0].customerid
    //       // get cardID
    //       const select_card = `SELECT cardID FROM card WHERE card.name = '${card_name}';`
    //       dbClient.query(select_card, (err, cardIDs) => {
    //         if(err) {
    //             next(err)
    //         } else {
    //             const cardID = cardIDs.rows[0].cardid
    //             // add card to customer
    //             // insert row into cardOwnership table
    //             const add_card = `INSERT INTO cardOwnership (customerID, cardID) VALUES ('${customerID}', '${cardID}');`
    // 
    //             dbClient.query(add_card, (err, result) => {
    //                 const select_cc_info = `SELECT cd.name, ct.value, ct.multiplier 
    //                                           FROM customer AS cu JOIN cardOwnership AS co ON cu.customerID = co.customerID
    //                                           JOIN card AS cd ON co.cardID = cd.cardID
    //                                           JOIN category AS ct ON cd.cardID = ct.cardID
    //                                           WHERE cu.username = '${username}'`
    //                 if (err) {
    //                     // next(err)
    //                     const error = "You already own this card"
    //                     dbClient.query(select_cc_info, (err, result) => {
    //                         if(err) {
    //                             next(err)
    //                         } else {
    //                             // success 
    //                             var creditCardData = {}
    //                             for (creditCardInfo of result.rows) {
    //                                 const card_name = creditCardInfo.name
    //                                 const category_name = creditCardInfo.value
    //                                 const category_multiplier = creditCardInfo.multiplier
    // 
    //                                 if (!creditCardData.hasOwnProperty(card_name)) {
    //                                     creditCardData[card_name] = {categories: []}
    //                                 }
    // 
    //                                 creditCardData[card_name].categories.push({name: category_name, multiplier: category_multiplier})
    //                             }
    // 
    //                             // res.send(`Added ${card_name} to ${username}`)
    //                             res.render('userCards', { creditCards: creditCardData, error: error, fname: fname, username: username, app_name: 'Max Points'})
    //                             // res.render('userCards', { creditCards: creditCardData, fname: fname, username: username, app_name: 'Max Points'})
    //                         }
    //                     })
    //                 } else {
    //                     console.log(`Added ${card_name} to ${username}`);
    //                     dbClient.query(select_cc_info, (err, result) => {
    //                         if(err) {
    //                             next(err)
    //                         } else {
    //                             // success 
    //                             var creditCardData = {}
    //                             for (creditCardInfo of result.rows) {
    //                                 const card_name = creditCardInfo.name
    //                                 const category_name = creditCardInfo.value
    //                                 const category_multiplier = creditCardInfo.multiplier
    // 
    //                                 if (!creditCardData.hasOwnProperty(card_name)) {
    //                                     creditCardData[card_name] = {categories: []}
    //                                 }
    // 
    //                                 creditCardData[card_name].categories.push({name: category_name, multiplier: category_multiplier})
    //                             }
    // 
    //                             // res.send(`Added ${card_name} to ${username}`)
    //                             res.render('userCards', { creditCards: creditCardData, fname: fname, username: username, app_name: 'Max Points'})
    //                         }
    //                     }) 
    //                 }
    //             })
    //             // res.render('userCards', { creditCards: fakeData['creditCards'], fname: fname, username: username, app_name: 'Max Points'})
    //         }
    //       });
    //   }
    // });
})

app.post('/removecard', (req, res, next) => {
    const card_name = req.body.cardname
    const username = req.body.username
    const fname = req.body.fname
    
    // get customerID
    const select_customer = `SELECT customerID FROM customer WHERE customer.username = '${username}';`
    dbClient.query(select_customer,(err, customerIDs) => {
      if(err) {
          next(err)
      } else {
          const customerID = customerIDs.rows[0].customerid
          // get cardID
          const select_card = `SELECT cardID FROM card WHERE card.name = '${card_name}';`
          dbClient.query(select_card, (err, cardIDs) => {
            if(err) {
                next(err)
            } else {
                const cardID = cardIDs.rows[0].cardid
                // remove card from customer
                // delete row from cardOwnership table
                const delete_card = `DELETE FROM cardOwnership as co WHERE co.customerID = '${customerID}' AND co.cardID = '${cardID}';`
                dbClient.query(delete_card, (err, result) => {
                    const select_cc_info = `SELECT cd.name, ct.value, ct.multiplier 
                                              FROM customer AS cu JOIN cardOwnership AS co ON cu.customerID = co.customerID
                                              JOIN card AS cd ON co.cardID = cd.cardID
                                              JOIN category AS ct ON cd.cardID = ct.cardID
                                              WHERE cu.username = '${username}'`
                    if (err) {
                        // next(err)
                        const error = "You don't own this card"
                        dbClient.query(select_cc_info, (err, result) => {
                            if(err) {
                                next(err)
                            } else {
                                // success 
                                var creditCardData = {}
                                for (creditCardInfo of result.rows) {
                                    const card_name = creditCardInfo.name
                                    const category_name = creditCardInfo.value
                                    const category_multiplier = creditCardInfo.multiplier
                                    
                                    if (!creditCardData.hasOwnProperty(card_name)) {
                                        creditCardData[card_name] = {categories: []}
                                    }
                                    
                                    creditCardData[card_name].categories.push({name: category_name, multiplier: category_multiplier})
                                }
                                
                                // res.send(`Added ${card_name} to ${username}`)
                                res.render('userCards', { creditCards: creditCardData, error: error, fname: fname, username: username, app_name: 'Max Points'})
                                // res.render('userCards', { creditCards: creditCardData, fname: fname, username: username, app_name: 'Max Points'})
                            }
                        })
                    } else {
                        console.log(`Deleted ${card_name} from ${username}`);
                        dbClient.query(select_cc_info, (err, result) => {
                            if(err) {
                                next(err)
                            } else {
                                // success 
                                var creditCardData = {}
                                for (creditCardInfo of result.rows) {
                                    const card_name = creditCardInfo.name
                                    const category_name = creditCardInfo.value
                                    const category_multiplier = creditCardInfo.multiplier
                                    
                                    if (!creditCardData.hasOwnProperty(card_name)) {
                                        creditCardData[card_name] = {categories: []}
                                    }
                                    
                                    creditCardData[card_name].categories.push({name: category_name, multiplier: category_multiplier})
                                }
                                
                                // res.send(`Added ${card_name} to ${username}`)
                                res.render('userCards', { creditCards: creditCardData, fname: fname, username: username, app_name: 'Max Points'})
                            }
                        }) 
                    }
                })
            }
          });
      }
    });
})

app.post('/searchcategory', (req, res, next) => {
    const fname = req.body.fname
    const username = req.body.username
    let category_name = req.body.category_name
    // category_name = category_name.toLowerCase().replace(/\s/g, '')
    
    let select_cc_by_category
    
    if (category_name === "") {
        select_cc_by_category = `SELECT cd.name, ct.value, ct.multiplier 
                                  FROM customer AS cu JOIN cardOwnership AS co ON cu.customerID = co.customerID
                                  JOIN card AS cd ON co.cardID = cd.cardID
                                  JOIN category AS ct ON cd.cardID = ct.cardID
                                  WHERE cu.username = '${username}';`
    } else {
        select_cc_by_category = `SELECT cd.name, ct.value, ct.multiplier 
                                  FROM customer AS cu JOIN cardOwnership AS co ON cu.customerID = co.customerID
                                  JOIN card AS cd ON co.cardID = cd.cardID
                                  JOIN category AS ct ON cd.cardID = ct.cardID
                                  WHERE cu.username = '${username}' AND ct.value = '${category_name}';`
    }
    dbClient.query(select_cc_by_category, (err, result) => {
        if(err) {
            next(err)
        } else {
            // success
            var creditCardData = {}
            for (creditCardInfo of result.rows) {
                const card_name = creditCardInfo.name
                const category_name = creditCardInfo.value
                const category_multiplier = creditCardInfo.multiplier
                
                if (!creditCardData.hasOwnProperty(card_name)) {
                    creditCardData[card_name] = {categories: []}
                }
                creditCardData[card_name].categories.push({name: category_name, multiplier: category_multiplier})
            }
          
            res.render('userCards', { creditCards: creditCardData, searchcategory: category_name, fname: fname, username: username, app_name: 'Max Points'})
        }
    })
})

app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`))