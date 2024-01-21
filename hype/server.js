"use strict";
const reload = require('require-reload')(require);
var socketio = require("socket.io");
var io;
var hypeSocket;
var pollSocket;
var predSocket;
require("greenlock-express").init({
	packageRoot: __dirname,
	configDir: "./greenlock.d",
	maintainerEmail: "duckie@ijustreallylikeducks.com",
	cluster: false
}).ready(httpsWorker);
var started = true;
var fading = false;
var characters = {};
var spriteList = reload('./sprite.js');
const canvasWidth = 1920;
const canvasHeight = 1080;




function updateCharacters() {
	if (started && Object.keys(characters).length > 0 || fading && Object.keys(characters).length > 0 ) {
		for (const characterId in characters) {
			const character = characters[characterId];
			if (character.life === 0) {
				delete characters[characterId];
			} else {
				character.velocityY += 1;
				character.y += character.velocityY;

				if (character.y > canvasHeight - character.height) {
					character.y = canvasHeight - character.height;
					character.velocityY = 0;
				}
				if (character.x < 0 || character.x > canvasWidth - character.width) {
					character.direction *= -1;
				}
				character.x += character.speed * character.direction;
				character.life -= 1;
				character.health = Math.round(((character.life / character.totalLife) + Number.EPSILON) * 100)
			}
		}
		hypeSocket.emit('updateCharacters', characters);
	}
}

function randomlyJump() {
	if (Object.keys(characters).length < 15) {
		for (const characterId in characters) {
			if (Math.random() < 0.2) {
				const randomJumpStrength = Math.random() * (-20 - (-10)) + (-10);
				characters[characterId].velocityY = randomJumpStrength;
				hypeSocket.emit('updateCharacters', characters);
			}
		}
	}
}

function getSprite(spritePicked, userRoles) {
	var a = new Set(userRoles)
	var b = new Set('holding')
	if (spritePicked === 'shell') {
		b = new Set(spriteList['shyguy_red'].roleRestrictions)
	} else if (spritePicked === 'shyguy') {
		b = new Set(spriteList['gShell'].roleRestrictions)
	} else { // not shell, not shyguy, does sprite exist?
		var keys = Object.keys(spriteList);
		if (keys.includes(spritePicked)) {
			b = new Set(spriteList[spritePicked].roleRestrictions) // not shell, check sprite
		} else {
			b = new Set()
		}
	}

	var intersect = new Set([...a].filter(i => b.has(i)));
	var intsize = intersect.size
	if (a.has('Streamer')) {
		intsize = 9;
	}
	if (intsize == 0) {
		return spriteList['default'];
	} else {
		if (spritePicked === 'shell') { //shell?
			var shellRand = Math.floor(Math.random() * 100);
			switch (true) {
			case shellRand >= 90:
				return spriteList.dShell;
				break;
			case shellRand >= 60:
				return spriteList.rShell;
				break;
			case shellRand >= 30:
				return spriteList.gShell;
				break;
			default:
				return spriteList.bShell;
			}
		} else if (spritePicked === 'shyguy') {
			var shyRand = Math.floor(Math.random() * 4);
			switch (shyRand) {
			case 0:
				return spriteList.shyguy_grey;
				break;
			case 1:
				return spriteList.shyguy_red;
				break;
			case 2:
				return spriteList.shyguy_green;
				break;
			case 3:
				return spriteList.shyguy_blue;
				break;
			default:
				return spriteList.shyguy_red;
			}
		} else if (spritePicked === 'yoshi') {
			var yoshiRand = Math.floor(Math.random() * 8);
			switch (yoshiRand) {
			case 0:
				return spriteList.yoshiblue;
				break;
			case 1:
				return spriteList.yoshigreen;
				break;
			case 2:
				return spriteList.yoshilightblue;
				break;
			case 3:
				return spriteList.yoshiorange;
				break;
			case 4:
				return spriteList.yoshipurple;
				break;
			case 5:
				return spriteList.yoshired;
				break;
			case 6:
				return spriteList.yoshiteal;
				break;
			default:
				return spriteList.yoshiyellow;
			}
		} else { //not shell... or shyguy
			return spriteList[spritePicked] || spriteList['default'];
		}
	}
}

function httpsWorker(glx) {
	//Required things
	const reload = require('require-reload')(require);

	//main app loads
	const express = require('express');
	const expressRaw = express.raw({
		type: 'application/json'
	})
	const app = express();
	const http = require('http');
	const socketIO = require('socket.io');
	const axios = require('axios');


	const path = require('path');
	const dotenv = require('dotenv');
	const crypto = require('crypto');

	//database loads
	const {
		MongoClient
	} = require('mongodb');
	const databaseUrl = "mongodb://ec2-35-172-11-72.compute-1.amazonaws.com:27017/";
	const dbClient = new MongoClient(databaseUrl);

	const HMAC_PREFIX = 'sha256=';


	try {
		dbClient.connect();
		console.log('Connected to the database');
	} catch (error) {
		console.error('Error connecting to the database:', error);
	}

	const database = dbClient.db('twitch');
	const collection = database.collection('tokens');

	// Load .env
	dotenv.config();

	//Variables used here
	const callbackUrl = 'https://hype.gamblingratsnest.com/api/callback';
	const clientID = process.env.CLIENT_ID;
	const clientSecret = process.env.CLIENT_SECRET;
	const SECRET = process.env.SECRET;
	const scope = encodeURIComponent('channel:read:predictions channel:manage:predictions user:read:email channel:read:polls');

	var twitchUserID = '';
	var state = crypto.randomUUID();
	var access_token = '';
	var app_token = '';
	var refresh_token = '';

	//twitch vars
	const TWITCH_MESSAGE_ID = 'Twitch-Eventsub-Message-Id'.toLowerCase();
	const TWITCH_MESSAGE_TIMESTAMP = 'Twitch-Eventsub-Message-Timestamp'.toLowerCase();
	const TWITCH_MESSAGE_SIGNATURE = 'Twitch-Eventsub-Message-Signature'.toLowerCase();
	const MESSAGE_TYPE = 'Twitch-Eventsub-Message-Type'.toLowerCase();

	const MESSAGE_TYPE_VERIFICATION = 'webhook_callback_verification';
	const MESSAGE_TYPE_NOTIFICATION = 'notification';
	const MESSAGE_TYPE_REVOCATION = 'revocation';



	app.use(express.static(path.join(__dirname, 'public')));
	var server = glx.httpsServer();
	io = socketio(server);
	hypeSocket = io.of('/hype');
	pollSocket = io.of('/poll');
	predSocket = io.of('/pred');

	//FUNCTIONS
	function setRefresh(timout, id, refreshToken) {
		setTimeout(function () {
			console.log('refreshing...')
			axios.post('https://id.twitch.tv/oauth2/token', {
				client_id: clientID,
				client_secret: clientSecret,
				grant_type: 'refresh_token',
				refresh_token: refreshToken,
				redirect_uri: callbackUrl
			}).then((response) => {
				access_token = response.data.access_token;
				refresh_token = response.data.refresh_token;
				console.log(`access_token: ${access_token}\nrefresh_token: ${refresh_token}`);
				console.log(response.data);
				var dbDocument = {
					_id: id,
					id: id,
					accessToken: response.data.access_token,
					refreshToken: response.data.refresh_token,
					userExpireTime: response.data.expires_in,
				};
				collection.updateOne({
					_id: id
				}, {
					$set: dbDocument
				}).then((result) => {
					console.log('Document Updated:', result)
				}).catch((error) => {
					console.log('Document Update Error:', error)
				})
				setRefresh((response.data.expires_in), id, response.data.refresh_token)
			}).catch((error) => console.log(error));
		}, (timout-1000)*1000)
	}

	function storeUser(userData, appData) {
		console.log('User Data:', userData);
		console.log('App Data:', appData);
		var tempData
		var dbDocument
		axios.get(`https://api.twitch.tv/helix/users`, {
				headers: {
					'Authorization': `Bearer ${userData.access_token}`,
					'Client-Id': clientID
				}
			}).then((response) => {
				console.log('tempData:', response.data.data[0])
				tempData = response.data.data[0]
				var dbDocument = {
					_id: tempData.id,
					id: tempData.id,
					login: tempData.login,
					display_name: tempData.display_name,
					email: tempData.email,
					appToken: appData.access_token,
					appExpireTime: appData.expires_in - 1000,
					accessToken: userData.access_token,
					refreshToken: userData.refresh_token,
					userExpireTime: userData.expires_in - 1000,
				};
				setRefresh((userData.expires_in), tempData.id, userData.refresh_token)
				console.log('Doing all the subs!')
				console.log('prediction.begin')
				subscribe(tempData.id ,appData.access_token, 'channel.prediction.begin')
				console.log('prediction.progress')
				subscribe(tempData.id ,appData.access_token, 'channel.prediction.progress')
				console.log('prediction.end')
				subscribe(tempData.id ,appData.access_token, 'channel.prediction.end')
				console.log('channel.poll.begin')
				subscribe(tempData.id ,appData.access_token, 'channel.poll.begin')
				console.log('channel.poll.progress')
				subscribe(tempData.id ,appData.access_token, 'channel.poll.progress')
				console.log('channel.poll.end')
				subscribe(tempData.id ,appData.access_token, 'channel.poll.end')
				console.log('Done with subs!')
				collection.findOne({
					_id: tempData.id
				}).then((result) => {
					console.log('result:', result)
					if (result === null) {
						collection.insertOne(dbDocument).then(result => {
							console.log('Inserted Document:', result)
						}).catch(error => {
							console.log('Insert Document Error:', error);
						})
					} else {
						collection.updateOne({
							_id: tempData.id
						}, {
							$set: dbDocument
						}).then((result) => {
							console.log('Document Updated:', result)
						}).catch((error) => {
							console.log('Document Update Error:', error)
						})
					}
				}).catch((error) => {

				})
			})
			.catch((error) => {
				console.log('error:', error)
			});
	}

	function subscribe(id, appToken, subType) {
		var postData = {
			type: subType,
			version: "1",
			condition: {
				broadcaster_user_id: id
			},
			transport: {
				method: "webhook",
				callback: "https://hype.gamblingratsnest.com/api/webhook",
				secret: clientSecret
			}
		}
		axios.post("https://api.twitch.tv/helix/eventsub/subscriptions", postData, {
				headers: {
					'Authorization': `Bearer ${appToken}`,
					'Client-Id': clientID,
					'Content-Type': 'application/json'
				}
			})
			.then((response) => {
				console.log(`response.data: ${response}`);
			})
			.catch((error) => {
				console.log('error:', error);
			})
	}

	function getUserId(access_token) {
	  return new Promise((resolve, reject) => {
		console.log('getUserId');
		axios.get(`https://api.twitch.tv/helix/users`, {
		  headers: {
			'Authorization': `Bearer ${access_token}`,
			'Client-Id': clientID
		  }
		})
		.then((response) => {
		  //console.log(response);
		  resolve(response);
		})
		.catch((error) => {
		  console.log(error);
		  reject(error);
		});
	  });
	}

	function getHmacMessage(request) {
		return (request.headers[TWITCH_MESSAGE_ID] + request.headers[TWITCH_MESSAGE_TIMESTAMP] + request.body);
	}

	function getHmac(secret, message) {
		return crypto.createHmac('sha256', secret).update(message).digest('hex');
	}


	function verifyMessage(hmac, verifySignature) {
		return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(verifySignature));
	}

	//ROUTES
	app.get('/addCharacter', (req, res) => {
		if (req.query.secret !== SECRET) {
			res.status(400).send(`NOT ALLOWED`)
		} else {
			if (started) {
				var trueX = canvasWidth / 2;
				var newCharacterId = Date.now().toString();
				var roles = '';
				var holdingroles = '';
				if (typeof req.query.roles === "undefined") {
					roles = ["Viewer"];
				} else {
					holdingroles = req.query.roles.replace(/\[/g, "").replace(/\]/g, "").replace(/\"/g, "");
					roles = holdingroles.split(",")
				}
				var newName = req.query.name || `Player-${newCharacterId.substr(0, 5)}`;
				var nameExists = Object.values(characters).some(character => character.name === newName);
				if (!nameExists) {
					var initialX = Math.random() * (canvasWidth - 300);
					var characterSprite = getSprite(req.query.sprite, roles);
					var initialY = canvasHeight - characterSprite.spriteHeight - 100;
					var charSpeed = (Math.random() * 4) + 2;
					characters[newCharacterId] = {
						x: initialX,
						y: initialY,
						direction: 1, 
						speed: charSpeed,	//no
						velocityY: 0,		//no
						name: newName,
						spriteName: characterSprite.spriteName,
						sprite: characterSprite.spritePath,
						width: characterSprite.spriteWidth,
						height: characterSprite.spriteHeight,
						frameCount: characterSprite.frameCount,
						currentFrame: 0,
						life: 10800,		//no
						totalLife: 10800,	//no
						health: Math.round(((10800 / 10800) + Number.EPSILON) * 100),
					};
					hypeSocket.emit('updateCharacters', characters);
					res.send(`Character added`);
				} else {
					for (const characterId in characters) {
						if (characters[characterId].name === req.query.name) {
							var charSpeed = (Math.random() * 4) + 2
							var characterSprite = getSprite(req.query.sprite, roles);
							characters[characterId] = {
								x: ((characters[characterId].x > 1500) ? (canvasWidth / 2) : ((characters[characterId].x < 400) ? (canvasWidth / 2) : characters[characterId].x)),
								y: characters[characterId].y,
								direction: characters[characterId].direction,
								speed: charSpeed,
								velocityY: characters[characterId].velocityY,
								name: characters[characterId].name,
								spriteName: characterSprite.spriteName,
								sprite: characterSprite.spritePath,
								width: characterSprite.spriteWidth,
								height: characterSprite.spriteHeight,
								frameCount: characterSprite.frameCount,
								currentFrame: 0,
								life: characters[characterId].life,
								totalLife: characters[characterId].totalLife,
								health: characters[characterId].health,
							};
						}
					}
				}
			} else {
				res.status(400).send(`party not started yet`)
			}
		}
	});

	app.get('/jump', (req, res) => {
		if (req.query.secret !== SECRET) {
			res.status(400).send(`NOT ALLOWED`)
		} else {
			for (const characterId in characters) {
				const randomJumpStrength = Math.random() * (-20 - (-10)) + (-10);
				characters[characterId].velocityY = randomJumpStrength;
			}
			hypeSocket.emit('updateCharacters', characters);
			res.send('All characters forced to jump.');
		}
	});

	app.get('/end', (req, res) => {
		if (req.query.secret !== SECRET) {
			res.status(400).send(`NOT ALLOWED`)
		} else {
			fading = true;
			started = false;
			hypeSocket.emit('fadeAway');
			res.send('end');
			setTimeout(function() {
				characters = {};
				fading = false;
				hypeSocket.emit('updateCharacters', characters);
			}, 40*1000)
		}
	});

	app.get('/start', (req, res) => {
		if (req.query.secret !== SECRET) {
			res.status(400).send(`NOT ALLOWED`)
		} else {
			started = true;
			hypeSocket.emit('start');
			hypeSocket.emit('updateCharacters', characters);
			res.send('start');
		}
	});

	app.get('/reload', (req, res) => {
		if (req.query.secret !== SECRET) {
			res.status(400).send(`NOT ALLOWED`)
		} else {
			try {
				spriteList = reload('./sprite.js');
				res.send('reloaded');
			} catch (e) {
				console.error("Failed to reload sprites Error: ", e);
				res.status(400).send('e');
			}
		}
	});

	app.get('/life', (req, res) => {
		if (req.query.secret !== SECRET) {
			res.status(400).send(`NOT ALLOWED`)
		} else {
			for (const characterId in characters) {
				characters[characterId].life += 10800;
				characters[characterId].totalLife += 10800;
			}
			hypeSocket.emit('updateCharacters', characters);
			res.send('Life Extended');
		}
	});

	app.get('/sprites.html', (req, res) => {
		res.sendFile('sprites.html', {
			root: 'public'
		});
	});
	
	app.get('/poll', (req, res) => {
		res.sendFile('poll.html', {
			root: 'public'
		});
	});
	
	app.get('/pred', (req, res) => {
		res.sendFile('pred.html', {
			root: 'public'
		});
	});

	app.get('/api/test', (req, res) => {
		if (req.query.name === undefined) {
			res.status(400).send(`NOT ALLOWED`)
		} else {
			getUserId(req.query.name)
			res.send('Boop');
		}
	});

	app.get('/api/holding', (req, res) => {
		console.log('in holding')
		var token = req.query.token;
		getUserId(token)
		.then((response) => {
			res.send(`Poll Page: https://hype.gamblingratsnest.com/poll?id=${response.data.data[0].id}<br>Prediction Page: https://hype.gamblingratsnest.com/pred?id=${response.data.data[0].id}`)
		})
		.catch((error) => {
			console.log('holding error:', error)
			res.send('error')
		})
		
	});

	app.post('/api/webhook', expressRaw, (req, res) => {
		var data;
		var message = getHmacMessage(req);
		var hmac = HMAC_PREFIX + getHmac(clientSecret, message);
		if (true === verifyMessage(hmac, req.headers[TWITCH_MESSAGE_SIGNATURE])) {
			console.log("signatures match");
			let notification = JSON.parse(req.body);
			if (MESSAGE_TYPE_NOTIFICATION === req.headers[MESSAGE_TYPE]) {
				// TODO: Do something with the event's data.
				console.log(`Event type: ${notification.subscription.type}`);
				switch (true) {
					case (notification.subscription.type === 'channel.poll.begin'):
						data = {
							id: notification.event.broadcaster_user_id,
							title: notification.event.title,
							choices: notification.event.choices,
							status: notification.event.status
						}
						pollSocket.emit('poll.begin', data);
						break;
					case (notification.subscription.type === 'channel.poll.progress'):
						var total_votes = notification.event.choices.reduce((x,{votes}) => x + votes, 0);
						data = {
							id: notification.event.broadcaster_user_id,
							title: notification.event.title,
							total_votes: total_votes,
							choices: notification.event.choices,
							status: notification.event.status
						}
						pollSocket.emit('poll.progress', data);
						break;
					case (notification.subscription.type === 'channel.poll.end'):
						data = {
							id: notification.event.broadcaster_user_id,
							title: notification.event.title,
							choices: notification.event.choices,
							status: notification.event.status
						}
						pollSocket.emit('poll.end', data);
						break;
					case (notification.subscription.type === 'channel.prediction.begin'):
						data = {
							id: notification.event.broadcaster_user_id,
							title: notification.event.title,
							choices: notification.event.outcomes
						}
						predSocket.emit('pred.begin', data);
						break;
					case (notification.subscription.type === 'channel.prediction.progress'):
						var total_points = notification.event.outcomes.reduce((accumulator, outcome) => {return accumulator + (outcome.channel_points || 0);}, 0);
						data = {
							id: notification.event.broadcaster_user_id,
							title: notification.event.title,
							total_points: total_points,
							choices: notification.event.outcomes
						}
						predSocket.emit('pred.progress', data);
						break;
					case (notification.subscription.type === 'channel.prediction.end'):
						var total_points = notification.event.outcomes.reduce((accumulator, outcome) => {return accumulator + (outcome.channel_points || 0);}, 0);
						data = {
							id: notification.event.broadcaster_user_id,
							title: notification.event.title,
							total_points: total_points,
							choices: notification.event.outcomes
						}
						predSocket.emit('pred.end', data);
						break;
					default:
						console.log(JSON.stringify(notification.event, null, 4));
						break;
				}

				console.log(`Event type: ${notification.subscription.type}`);
				console.log(JSON.stringify(notification.event, null, 4));
				res.sendStatus(204);
			} else if (MESSAGE_TYPE_VERIFICATION === req.headers[MESSAGE_TYPE]) {
				res.set('Content-Type', 'text/plain').status(200).send(notification.challenge);
			} else if (MESSAGE_TYPE_REVOCATION === req.headers[MESSAGE_TYPE]) {
				res.sendStatus(204);
				console.log(`${notification.subscription.type} notifications revoked!`);
				console.log(`reason: ${notification.subscription.status}`);
				console.log(`condition: ${JSON.stringify(notification.subscription.condition, null, 4)}`);
			} else {
				res.sendStatus(204);
				console.log(`Unknown message type: ${req.headers[MESSAGE_TYPE]}`);
			}
		} else {
			console.log('403');
			res.sendStatus(403);
		}
	})

	app.get('/api/callback', (req, res) => {
		console.log('getting user')
		var userData
		var appData
		axios.post('https://id.twitch.tv/oauth2/token', {
			client_id: clientID,
			client_secret: clientSecret,
			grant_type: 'authorization_code',
			code: req.query.code,
			redirect_uri: callbackUrl
		}).then((response) => {
			userData = response.data;
			console.log('got user.. now get app..');
			axios.post('https://id.twitch.tv/oauth2/token', {
				client_id: clientID,
				client_secret: clientSecret,
				grant_type: 'client_credentials',
			}).then((response) => {
				appData = response.data;
				setTimeout(function() { storeUser(userData, appData) }, 5)
			}).then((response) => {
				res.redirect(`/api/holding?token=${userData.access_token}`);
			}).catch((error) => {console.log(error)
				res.sendStatus(403)});
		}).catch((error) => {
			console.log(error)
			res.sendStatus(403)});
	});


	app.get('/api/auth', (req, res) => {
		state = crypto.randomUUID();
		res.send(`<a href="https://id.twitch.tv/oauth2/authorize?response_type=code&client_id=${clientID}&redirect_uri=${callbackUrl}&scope=${scope}&state=${state}">Connect with Twitch</a>`);
	});


	var lot = collection.find()
	lot.forEach((user) => {
		setRefresh(10, user.id, user.refreshToken)
	})

	setInterval(updateCharacters, 1000 / 60);
	setInterval(randomlyJump, 2500);
	setInterval(() => {
		for (const characterId in characters) {
			characters[characterId].currentFrame = (characters[characterId].currentFrame + 1) % characters[characterId].frameCount;
		}
	}, 101)
	glx.serveApp(app);
}