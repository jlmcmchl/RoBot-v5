const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./servers.sqlite');
const fs = require("fs");
const unirest = require("unirest")
var afkJson = fs.readFileSync("./afk.json"),
	afk = JSON.parse(afkJson),
	channel = null,
	stdin = process.openStdin();

module.exports = (bot) => {
	/**
	 * Server Related Functions
	 */

	bot.fetchGuildSize = function () {
		return new Promise(
			function (resolve, reject) {
				if (bot.shard) {
					bot.shard.fetchClientValues('guilds.size').then(g => {
						resolve(g.reduce((prev, val) => prev + val, 0));
					}).catch(console.error);
				} else {
					resolve(bot.guilds.size);
				}
			}
		)
	}

	bot.sendServerCount = function () {
		var guilds;
		if (bot.shard) {
			bot.shard.fetchClientValues('guilds.size').then(g => {
				guilds = g.reduce((prev, val) => prev + val, 0)
			}).catch(console.error);
		} else {
			guilds = bot.guilds.size;
		}

		unirest.post("https://bots.discordlist.net/api")
			.send({ "token": bot.config.dlist, "servers": guilds })
			.end(function (response) {
				bot.log(response.body);
			});

		unirest.post("https://bots.discord.pw/api/bots/" + bot.user.id + "/stats")
			.headers({ 'Authorization': bot.config.dbotspw, 'Content-Type': 'application/json' })
			.send({ "server_count": guilds })
			.end(function (response) {
				bot.log(response.body);
			});

		unirest.post("https://discordbots.org/api/bots/" + bot.user.id + "/stats")
			.headers({ 'Authorization': bot.config.dbotsorg, 'Content-Type': 'application/json' })
			.send({ "server_count": guilds })
			.end(function (response) {
				bot.log(response.body);
			});

		bot.log("All server counts posted successfully!");
	}

	bot.syncServers = function () {
		db.serialize(function () {
			db.run(`CREATE TABLE IF NOT EXISTS servers (
				id VARCHAR(25) PRIMARY KEY, 
				name VARCHAR(100), 
				prefix VARCHAR(10), 
				announcementChannel VARCHAR(25), 
				welcomeMessagesEnabled BOOLEAN, 
				welcomeMessage VARCHAR(200), 
				leaveMessagesEnabled BOOLEAN, 
				leaveMessage VARCHAR(200),
				banMessagesEnabled BOOLEAN,
				banMessage VARCHAR(200),
				joinRole VARCHAR(20),
				joinBotRole VARCHAR(20), 
				noInviteLinks BOOLEAN,
				noMentionSpam BOOLEAN,
				givemeRoles BLOB)`
			);
			bot.guilds.forEach(guild => {
				db.run(`INSERT OR IGNORE INTO servers VALUES (
					"${guild.id}", 
					"${guild.name}", 
					"${bot.config.prefix}", 
					"${guild.channels.array()[0].id}", 
					0, 
					"Welcome {username} to the server!", 
					0, 
					"{username} left the server :cry:",
					0,
					"{username} was banned from the server :hammer:", 
					"none", 
					"none", 
					0,
					0,
					"")`
				);
			});
		});
		bot.log("Servers synced.")
	}

	bot.removeServer = function (guild) {
		db.run(`DELETE FROM servers WHERE id = ${guild.id}`);
		bot.log(guild.name + " successfully removed from the database!");
	}

	bot.addServer = function (guild) {
		db.run(`INSERT OR IGNORE INTO servers VALUES (
			"${guild.id}", 
			"${guild.name}", 
			"${bot.config.prefix}", 
			"${guild.channels.array()[0].id}", 
			0, 
			"Welcome {username} to the server!", 
			0, 
			"{username} left the server :cry:",
			0,
			"{username} was banned from the server :hammer:", 
			"none", 
			"none", 
			0,
			0,
			"")`
		);
		bot.log(guild.name + " successfully inserted into the database!");
	}

	/**
	 * Giveme Roles Functions
	 */

	bot.setGivemeRoles = function (roles, guild) {
		roles = roles.join(',');
		db.run(`UPDATE servers SET givemeRoles = "${roles}" WHERE id = ${guild.id}`);
		return roles;
	}

	bot.getGivemeRoles = function (guild) {
		return new Promise(
			function (resolve, reject) {
				db.all(`SELECT * FROM servers WHERE id = "${guild.id}"`, function (err, rows) {
					if (err || !rows[0])
						reject(err);
					else
						resolve(rows[0].givemeRoles)
				});
			}
		)
	}
	
	/**
	 * Prefix Related Functions
	 */

	bot.getPrefix = function (msg) {
		return new Promise(
			function (resolve, reject) {
				db.all(`SELECT * FROM servers WHERE id = "${msg.guild.id}"`, function (err, rows) {
					if (err || !rows[0])
						reject(err);
					else
						resolve(rows[0].prefix)
				});
			}
		)
	}

	bot.setPrefix = function (prefix, guild) {
		db.run("UPDATE servers SET prefix = \"" + prefix + "\" WHERE id = " + guild.id);
		return prefix;
	}

	/**
	 * Server Settings Related Functions
	 */

	bot.setBanMessageEnabled = function (guild, setting) {
		db.run("UPDATE servers SET banMessagesEnabled = \"" + setting + "\" WHERE id = " + guild.id);
		return setting;
	}

	bot.setBanMessageText = function (id, text) {
		db.run(`UPDATE servers SET banMessage = "${text}" WHERE id = "${id}"`);
		return text;
	}

	bot.getBanMessageStatus = function (id) {
		return new Promise((resolve, reject) => {
			db.all("SELECT * FROM servers WHERE id = " + id, function (err, rows) {
				if (rows[0].banMessagesEnabled == 1)
					resolve(true);
				else
					resolve(false);
			});
		})
	}

	bot.setWelcomeMessageEnabled = function (guild, setting) {
		db.run("UPDATE servers SET welcomeMessagesEnabled = \"" + setting + "\" WHERE id = " + guild.id);
		return setting;
	}

	bot.setWelcomeMessageText = function (id, text) {
		db.run(`UPDATE servers SET welcomeMessage = "${text}" WHERE id = "${id}"`);
		return text;
	}

	bot.getWelcomeMessageStatus = function (id) {
		return new Promise((resolve, reject) => {
			db.all("SELECT * FROM servers WHERE id = " + id, function (err, rows) {
				if (rows[0].welcomeMessagesEnabled == 1)
					resolve(true);
				else
					resolve(false);
			});
		})
	}

	bot.setLeaveMessageEnabled = function (guild, setting) {
		db.run("UPDATE servers SET leaveMessagesEnabled = \"" + setting + "\" WHERE id = " + guild.id);
		return setting;
	}

	bot.setLeaveMessageText = function (id, text) {
		db.run(`UPDATE servers SET leaveMessage = "${text}" WHERE id = "${id}"`);
		return text;
	}

	bot.getLeaveMessageStatus = function (id) {
		return new Promise((resolve, reject) => {
			db.all("SELECT * FROM servers WHERE id = " + id, function (err, rows) {
				if (rows[0].leaveMessagesEnabled == 1)
					resolve(true);
				else
					resolve(false);
			});
		})
	}

	bot.setAnnouncementChannel = function (id, channel) {
		db.run("UPDATE servers SET announcementChannel = \"" + channel.id + "\" WHERE id = " + id);
		return channel;
	}

	bot.getAnnouncementChannel = function (id) {
		return new Promise((resolve, reject) => {
			db.all("SELECT * FROM servers WHERE id = " + id, function (err, rows) {
				resolve(rows[0].announcementChannel)
			});
		})
	}

	/**
	 * Core message processing functions
	 */

	//Implement categories of commands and check this based on those
	bot.enabled = function (command, guild) {
		return true;
	}

	bot.permLevel = function (msg) {
		if (msg.author.id == bot.config.owner)
			return 6;
		else if (msg.author.id == msg.guild.owner.id)
			return 5;
		else if (msg.member.hasPermission("MANAGE_GUILD"))
			return 4;
		else if (msg.member.hasPermission("MANAGE_ROLES_OR_PERMISSIONS"))
			return 3;
		else if (msg.member.hasPermission("MANAGE_MESSAGES"))
			return 2;
		else if (!bot.blacklist(msg.author.id))
			return 1;
		else
			return 0;
	}

	bot.processMessage = function (msg) {
		if (channel && msg.channel.id == channel) bot.log(msg.guild.name + " | " + msg.channel.name + " | " + msg.member.displayName + " | " + msg.cleanContent);

		if (msg.author.bot) return;

		var afkJson = fs.readFileSync("./afk.json"),
			afk = JSON.parse(afkJson);
		if (afk.length != 0) {
			for (let i = 0; i < afk.length; i++) {
				if (afk[i].id === msg.author.id) {
					afk.splice(i, 1);
					fs.writeFileSync("./afk.json", JSON.stringify(afk, null, 3));
					msg.channel.send(":ok_hand: Welcome back **" + msg.author.username + "**! I've removed your AFK status!");
				}
				if (msg.mentions.users.size > 0 && afk.length != 0) {
					if (msg.content.indexOf(afk[i].id) != -1 && msg.author.id != afk[i].id) {
						var nick = msg.guild.members.get(afk[i].id).displayName
						msg.channel.send({embed: new Discord.RichEmbed().setDescription(":robot: **" + nick + "** is AFK: **" + afk[i].reason + "**")})
							.then(msg => {
								setTimeout(function () {
									msg.delete()
								}, 20000)
							});
					}
				}
			}
		}

		if (msg.isMentioned(bot.user)) {
			if (msg.content.toLowerCase().includes("what's your prefix") || msg.content.toLowerCase().includes("whats your prefix")) {
				bot.getPrefix(msg).then(prefix => {
					msg.reply("my prefix for this server is `" + prefix + "`!")
				})
			}

			if (msg.content.toLowerCase().includes("resetprefix") && msg.member.hasPermission("ADMINISTRATOR")) {
				bot.setPrefix(config.prefix, msg.guild);
				msg.reply('I have reset this server\'s prefix to ``' + config.prefix + '``!')
			}
		}

		this.getPrefix(msg).then(prefix => {
			if (msg.content.startsWith(prefix)) {
				try {
					msg.args = msg.content.split(/\s+/g)
					msg.content = msg.content.substring(msg.content.indexOf(" ") + 1, msg.content.length) || null
					var command = msg.args.shift().slice(prefix.length).toLowerCase()
					var cmd = bot.commands.get(command) //|| bot.commands.get(bot.aliases.get(command))
					var perms = bot.permLevel(msg)

					if (!cmd) return;
					else if (perms == 0) return msg.reply("you are blacklisted from using the bot!");
					else if (perms < cmd.permission) return msg.reply("you do not have permission to do this!")

					else if (bot.enabled(cmd)) {
						bot.logCommand(command, msg.content, msg.author.username, msg.channel.name, msg.guild.name)
						try {
							cmd.main(bot, msg);
						} catch (err) {
							msg.channel.send("Oh no! We encountered an error:\n```" + err.stack + "```")
						}
					}
				} catch (err) {
					msg.channel.send("Oh no! We encountered an error:\n```" + err.stack + "```");
					bot.error(err.stack);
				}
			}
		})
	}

	/**
	 * Core bot functions
	 */

	bot.blacklist = function (id) {
		var blacklistJson = fs.readFileSync("./blacklist.json"),
			blacklist = JSON.parse(blacklistJson);
		for (var i = 0; i < blacklist.length; i++) {
			if (blacklist[i] == id)
				return true;
		}
		return false;
	}

	bot.startGameCycle = function () {
		bot.user.setGame(bot.config.games[Math.round(Math.random() * (bot.config.games.length - 1))] + ' | @' + bot.user.username + ' What\'s your prefix?', 'https://twitch.tv/discordapp');
		setInterval(() => {
			bot.user.setGame(bot.config.games[Math.round(Math.random() * (bot.config.games.length - 1))] + ' | @' + bot.user.username + ' What\'s your prefix?', 'https://twitch.tv/discordapp');
		}, 300000);
	}

	bot.awaitConsoleInput = function () {
		stdin.addListener("data", function (d) {
			d = d.toString().trim()
			if (d.startsWith("channels")) {
				bot.channels.forEach(channel => {
					if (channel.type == "text" && channel.permissionsFor(channel.guild.me).has(["READ_MESSAGES", "SEND_MESSAGES"]))
						bot.log(channel.guild.name + " | #" + channel.name + " | (" + channel.id + ")")
				})
			} else if (d.startsWith("bind") && channel) {
				d = d.substring(d.indexOf(" ") + 1, d.length)
				if (bot.channels.get(d)) {
					channel = d;
					bot.log("Console rebound to channel " + bot.channels.get(d).name + " in " + bot.channels.get(d).guild.name + "!");
				}
			} else if (channel) {
				try {
					bot.channels.get(channel).send(d);
				} catch (err) {
					bot.log(err);
				}
			} else {
				if (bot.channels.get(d)) {
					channel = d;
					bot.log("Console bound to channel " + bot.channels.get(d).name + " in " + bot.channels.get(d).guild.name + "!");
				}
			}
		});
	}

	bot.webhook = function (header, text, color) {
		var config = require('./config.json')
		var request = require('request')
		try {
			var d = {
				"attachments": [{
					"color": color,
					"fields": [{
						"title": header,
						"value": text
					}],
					"ts": new Date() / 1000
				}]
			}
			request({
				url: config.webhook + "/slack",
				method: "POST",
				body: d,
				json: true
			});
		} catch (err) {
			bot.error(err)
		}
	}

	bot.joinleavehook = function (type, guild) {
		var config = require('./config.json')
		var request = require('request')
		bot.fetchGuildSize().then(guilds => {
			try {
				if (bot.shard) {
					if (type == 'join') {
						var color = "#00FF00"
						var title = ":inbox_tray: New Guild! | Now in " + guilds + " guilds."
					} else if (type == 'leave') {
						var color = "#FF0000"
						var title = ":outbox_tray: Left Guild | Now in " + guilds + " guilds."
					}
				} else {
					if (type == 'join') {
						var color = "#00FF00"
						var title = ":inbox_tray: New Guild! | Now in " + guilds + " guilds."
					} else if (type == 'leave') {
						var color = "#FF0000"
						var title = ":outbox_tray: Left Guild | Now in " + guilds + " guilds."
					}
				}

				var members = 0, bots = 0;
				guild.members.forEach(member => {
					if (member.user.bot)
						bots = bots + 1;
					else
						members = members + 1;
				});

				var d = {
					"attachments": [{
						"color": color,
						"title": title,
						"thumb_url": guild.iconURL,
						"fields": [{
							"title": "Server Name",
							"value": guild.name,
							"short": true
						}, {
							"title": "Created",
							"value": guild.createdAt.toLocaleString(),
							"short": true
						}, {
							"title": "ID",
							"value": guild.id,
							"short": true
						}, {
							"title": "Owner",
							"value": guild.owner.user.username,
							"short": true
						}, {
							"title": "Member Count",
							"value": members,
							"short": true
						}, {
							"title": "Bot Count",
							"value": bots,
							"short": true
						}],
						"footer": bot.user.username,
						"ts": new Date() / 1000
					}]
				}

				if (guild.features[0]) {
					d.attachments[0].fields.push({ 'title': 'Features', 'value': guild.features.join('\n') })
					d.attachments[0].text = 'Partnered Server'

					if (guild.features.includes('INVITE_SPLASH'))
						d.attachments[0].image_url = guild.splashURL + "?size=2048"
				}

				request({
					url: config.logwebhook + "/slack",
					method: "POST",
					body: d,
					json: true
				});
			} catch (err) {
				bot.error(err)
			}
		})
	}

	/**
	 * Logging functions
	 */

	bot.logCommand = function(command, arguments, user, channel, server) {
		bot.log(`\n**Command Executed:** ${command}\n**User:** ${user}\n**Arguments:** ${arguments}\n**Server:** ${server}\n**Channel:** #${channel}`)
	}

	bot.error = function (err) {
		if (bot.shard) {
			console.log(this.timestamp() + " [SHARD " + bot.shard.id + "] [ERROR] | " + err.stack)
			bot.webhook("ERROR", "[SHARD " + bot.shard.id + "] [ERROR] | " + err.stack, "#FF0000")
		}
		else {
			console.log(this.timestamp() + " [ERROR] | " + err.stack)
			bot.webhook("ERROR", "[ERROR] | " + err.stack, "#FF0000")
		}
	}

	bot.debug = function (txt) {
		if (bot.shard)
			console.log(this.timestamp() + " [SHARD " + bot.shard.id + "] [DEBUG] | " + txt)
		else
			console.log(this.timestamp() + " [DEBUG] | " + txt)
	}

	bot.warn = function (txt) {
		if (bot.shard) {
			console.log(this.timestamp() + " [SHARD " + bot.shard.id + "] [WARN]  | " + txt)
			bot.webhook("Warning", " [SHARD " + bot.shard.id + "] [WARN]  | " + txt, "#FFFF00")
		}
		else {
			console.log(this.timestamp() + " [WARN]  | " + txt)
			bot.webhook("Warning", "[WARN]  | " + txt, "#FFFF00")
		}
	}

	bot.log = function (txt) {
		if (bot.shard) {
			console.log(this.timestamp() + " [SHARD " + bot.shard.id + "]  [LOG]  | " + txt)
			bot.webhook("Log", "[SHARD " + bot.shard.id + "] " + txt, "#000000");
		}
		else {
			console.log(this.timestamp() + "  [LOG]  | " + txt)
			bot.webhook("Log", txt, "#000000")
		}
	}

	bot.timestamp = function () {
		var currentTime = new Date(),
			hours = currentTime.getHours(),
			minutes = currentTime.getMinutes(),
			seconds = currentTime.getSeconds()
		if (minutes < 10)
			minutes = "0" + minutes;
		if (seconds < 10)
			seconds = "0" + seconds;
		return '[' + hours + ':' + minutes + ':' + seconds + ']';
	}

	/**
	 * Utility functions for information retrieval
	 */

	bot.displayServer = function(msg, serverID) {
		db.run(`SELECT * FROM servers WHERE id = ${serverID}`, function(err, row) {
			if (err)
				msg.channel.send(err);
			else
				msg.channel.send("```\nServer ID: " + row.id + "\nName: " + row.name + "\nPrefix" + row.prefix + "\nWelcome Channel: " + row.welcomeChannel + "\nWelcome Messages Enabled: " + row.welcomeMessagesEnabled + "\nWelcome Message: " + row.welcomeMessage + "\nMod Messages Channel: " + row.modMessagesChannel + "\nMod Messages Enabled: " + row.modMessagesEnabled + "\n```")
		});
	}
}