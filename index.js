//const http=require('http');
const fs = require('fs');
const request = require('request');
require('dotenv').config();
const headers = { Cookie: '.ROBLOSECURITY=' + process.env.roblosecurity };
const wUrl = process.env.discordWebhook

const players = process.env.Players.split(' ');
const places = process.env.Places.split(' ');

var hashCache = [];
function getPlayerHashes(players) {
	return new Promise(res => {
		if (players.length < 1) res([]);
		var a = []; players.forEach(p => {
			if (hashCache[p] != null) {
				a.push([p, hashCache[p]]);
				if (a.length == players.length) res(a);
			} else {
				var thumb = 'http://www.roblox.com/headshot-thumbnail/image?width=48&height=48&Format=Png&userId=' + p;
				request.get(thumb, (e, r, b) => {
					var redir = r.request.uri.href/*.replace('http','https')*/;
					a.push([p, hashCache[p] = redir]);
					if (a.length == players.length) res(a);
				});
			}
		});
	});
}

function playersInPlace(players, place) {
	return new Promise(async res => {
		var a = [];
		var hashes = await getPlayerHashes(players);
		if (hashes.length < 1) res(a);

		var m = await new Promise(res => {
			var url = `https://www.roblox.com/games/getgameinstancesjson?placeId=${place}&startIndex=0`;
			request.get({ url: url, headers: headers }, (e, r, b) => {
				if (!e && b[0] == '{') res(JSON.parse(b).TotalCollectionSize)
			});
		});

		var count1 = 0;
		var count2 = 0;
		for (var c = 0; c <= m; c += 5) {
			count1++;
			var url = `https://www.roblox.com/games/getgameinstancesjson?placeId=${place}&startIndex=${c}`;
			var rec = () => {
				request.get({ url: url, headers: headers }, (e, r, b) => {
					if (e || b[0] != '{') return setTimeout(rec, 6660);
					count2++;
					var t = JSON.parse(b);
					m = Math.max(t.TotalCollectionSize, m);
					t.Collection.forEach(coll => {
						coll.CurrentPlayers.forEach(srvPl => {
							for (var i = hashes.length - 1; i >= 0; i--) {
								var hash = hashes[i];
								if (srvPl.Thumbnail.Url == hash[1]) {
									a.push([hash[0], place, coll.Guid]);
									hashes.splice(i, 1);
								}
								if (hashes.length == 0) res(a);
							}
						});
					});
					if (count1 == count2 && count1 > 0) res(a);
				});
			};
			rec();
		}
	});
}

async function getPlayersOnline(players, places) {
	places = places.map(p => Number.parseInt(p));
	var all = await new Promise(res => {
		var a = [];
		players.forEach(p => {
			var url = 'https://www.roblox.com/search/users/presence?userIds=' + p;
			request.get({ url: url, headers: headers }, (e, r, b) => {
				if (!e && b[0] == '{') {
					var pp = JSON.parse(b).PlayerPresences[0];
					a.push([p, pp.InGame ? pp.PlaceId > 0 ? pp.PlaceId : undefined : null]);
					if (a.length == players.length) res(a);
				}
			});
		});
	});

	console.log('');
	console.log(new Date().toISOString());
	console.log(all);
	var filtered = all.filter(p => p[1] !== null).map(p => p[0]);

	all.forEach(v => {
		var id = parseInt(v[1]);
		if (!places.includes(id) && id)
			places.unshift(id);
	});

	return await new Promise(async res => {
		var a = [];
		for (var c = 0; c < places.length; c++) {
			const place = places[c];
			const results = await playersInPlace(filtered, place);
			results.forEach(t => {
				//var i = filtered.indexOf(t[0]);
				//if (i > -1) filtered.splice(i, 1);
				request.get(`https://api.roblox.com/users/${t[0]}`, (e, r, b) => {
					if (!e && b[0] == '{') {
						t.unshift(JSON.parse(b).Username);
						if (a.length + 1 != results.length) return;
						a.push(t);
						res(a);
					}
				});
			});
		}
	});
}

function update() {
	getPlayersOnline(players, places).then(a => {
		a.forEach(v => {
			if (!v[2]) return;
			var content = `\`\`\`js\n// User: ${v[0]} - ${v[1]}\nRoblox.GameLauncher.joinGameInstance(${v[2]},"${v[3]}")\`\`\``;
			console.log(v[0], v[1], `Roblox.GameLauncher.joinGameInstance(${v[2]},"${v[3]}")`);
			if (wUrl) request.post({ url: wUrl, json: { content: content } });
		});
	});
}

/*
const server=http.createServer((req,res)=>{
	res.statusCode=200;
	res.setHeader('Content-Type','text/plain');
	res.end('The server should be checking.');
});
server.listen(PORT,()=>{
	console.log(`Server running on ${PORT}/`);
});
setInterval(()=>{
	var url1='https://asimo3089.herokuapp.com/';
	var url2='https://asimo3089-tracker.herokuapp.com/';
	request.get(new Date().getDate()>15?url1:url2);
	update();
},69000);
*/

setInterval(update, 69000);
update();