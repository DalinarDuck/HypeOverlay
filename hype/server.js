"use strict";
const reload = require('require-reload')(require);
var socketio = require("socket.io");
var io;
require("greenlock-express").init({
    packageRoot: __dirname,
    configDir: "./greenlock.d",
    maintainerEmail: "duckie@ijustreallylikeducks.com",
    cluster: false
}).ready(httpsWorker);

let started = true;
let characters = {};
let spriteList = reload('./sprite.js');
const canvasWidth = 1920;
const canvasHeight = 1080;


function updateCharacters() {
    if (started && Object.keys(characters).length > 0) {
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
            }
        }
        io.emit('updateCharacters', characters);
    }
}

function randomlyJump() {
    if (Object.keys(characters).length < 35) {
        for (const characterId in characters) {
            if (Math.random() < 0.2) {
                const randomJumpStrength = Math.random() * (-20 - (-10)) + (-10);
                characters[characterId].velocityY = randomJumpStrength;
                io.emit('updateCharacters', characters);
            }
        }
    }
}

function getSprite(spritePicked, userRoles) {
	let a = new Set(userRoles) 
	let b = new Set('holding')
	if (spritePicked === 'shell') {
		b = new Set(spriteList['shyguy_red'].roleRestrictions) 
	} else if (spritePicked === 'shyguy') {
		b = new Set(spriteList['gShell'].roleRestrictions) 
	} else { // not shell, not shyguy, does sprite exist?
		let keys = Object.keys(spriteList); 
		if (keys.includes(spritePicked)) {
			b = new Set(spriteList[spritePicked].roleRestrictions) // not shell, check sprite
		} else {
			b = new Set()
		}
	}

	let intersect = new Set([...a].filter(i => b.has(i)));
	let intsize = intersect.size
	if (a.has('Streamer')){
		intsize = 9;
	}
	if (intsize == 0) {
		return spriteList['default'];
	} else {
		if (spritePicked === 'shell') { //shell?
			let shellRand = Math.floor(Math.random() * 100);
			switch (true){
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
			let shyRand = Math.floor(Math.random() * 4);
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
			let yoshiRand = Math.floor(Math.random() * 8);
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
		} else {			//not shell... or shyguy
			return spriteList[spritePicked] || spriteList['default'];
		}
	}
}

function httpsWorker(glx) {

    const express = require('express');
    const http = require('http');
    const socketIO = require('socket.io');
    const path = require('path');
    const reload = require('require-reload')(require);

    const dotenv = require('dotenv');
    dotenv.config();
    const SECRET = process.env.SECRET;
	const app = express();
    app.use(express.static(path.join(__dirname, 'public')));




    // we need the raw https server
    var server = glx.httpsServer();

    io = socketio(server);


    app.get('/addCharacter', (req, res) => {
        if (req.query.secret !== SECRET) {
            res.status(400).send(`NOT ALLOWED`)
        } else {
            if (started) {
				var trueX = canvasWidth/2;
                const newCharacterId = Date.now().toString();
                let roles = '';
                let holdingroles = '';
                if (typeof req.query.roles === "undefined") {
                    roles = ["Viewer"];
                } else {
                    holdingroles = req.query.roles.replace(/\[/g, "").replace(/\]/g, "").replace(/\"/g, "");
                    roles = holdingroles.split(",")
                }
                const newName = req.query.name || `Player-${newCharacterId.substr(0, 5)}`;
                const nameExists = Object.values(characters).some(character => character.name === newName);
                if (!nameExists) {
                    const initialX = Math.random() * (canvasWidth - 300);
                    const characterSprite = getSprite(req.query.sprite, roles);
                    const charSpeed = (Math.random() * 4) + 2;
                    characters[newCharacterId] = {
                        x: initialX,
                        y: 100,
                        direction: 1,
                        speed: charSpeed,
                        velocityY: 0,
                        name: newName,
                        spriteName: characterSprite.spriteName,
                        sprite: characterSprite.spritePath,
                        width: characterSprite.spriteWidth,
                        height: characterSprite.spriteHeight,
                        frameCount: characterSprite.frameCount,
                        currentFrame: 0,
                        life: 10800,
                        totalLife: 10800,
                    };
                    io.emit('updateCharacters', characters);
                    res.send(`Character added`);
                } else {
                    for (const characterId in characters) {
                        if (characters[characterId].name === req.query.name) {
                            const charSpeed = (Math.random() * 4) + 2
                            const characterSprite = getSprite(req.query.sprite, roles);
                            characters[characterId] = {
                                x: ((characters[characterId].x > 1700) ? (canvasWidth/2) : ((characters[characterId].x < 300) ? (canvasWidth/2) : characters[characterId].x)),
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
            io.emit('updateCharacters', characters);
            res.send('All characters forced to jump.');
        }
    });

/*     app.get('/updateSprite', (req, res) => {
        if (req.query.secret !== SECRET) {
            res.status(400).send(`NOT ALLOWED`)
        } else {
            let roles = '';
            let holdingroles = '';
            if (typeof req.query.roles === "undefined") {
                roles = ["Viewer"];
            } else {
                holdingroles = req.query.roles.replace(/\[/g, "").replace(/\]/g, "").replace(/\"/g, "");
                roles = holdingroles.split(",")
            }
            for (const characterId in characters) {
                if (characters[characterId].name === req.query.name) {
                    const charSpeed = (Math.random() * 4) + 2
                    const characterSprite = getSprite(req.query.sprite, roles);
                    characters[characterId] = {
                        x: characters[characterId].x,
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
                    };
                }
            }
            io.emit('updateCharacters', characters);
            res.send('sprite updated');
        }
    }); */

    app.get('/end', (req, res) => {
        if (req.query.secret !== SECRET) {
            res.status(400).send(`NOT ALLOWED`)
        } else {
            characters = {}
            started = false;
            io.emit('updateCharacters', characters);
            res.send('end');
        }
    });

    app.get('/start', (req, res) => {
        if (req.query.secret !== SECRET) {
            res.status(400).send(`NOT ALLOWED`)
        } else {
            started = true;
            io.emit('updateCharacters', characters);
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
            io.emit('updateCharacters', characters);
            res.send('Life Extended');
        }
    });


    app.get('/spriteList', (req, res) => {
        if (req.query.secret !== SECRET) {
            res.status(400).send(`NOT ALLOWED`)
        } else {
            let k = Object.keys(spriteList);
            res.send(k.splice(5).join(", "));
        }
    });

    app.get('/sprites.html', (req, res) => {
        res.sendFile('sprites.html', {
            root: 'public'
        });
    });

    setInterval(updateCharacters, 1000 / 60);
    setInterval(randomlyJump, 2500);
    setInterval(() => {
        for (const characterId in characters) {
            characters[characterId].currentFrame = (characters[characterId].currentFrame + 1) % characters[characterId].frameCount;
        }
    }, 101)
    // servers a node app that proxies requests to a localhost
    glx.serveApp(app);
}