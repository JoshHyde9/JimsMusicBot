// Include Packages
const Discord = require("discord.js");
const client = new Discord.Client();
const iterate = require("iterate-js");
const ytdl = require("ytdl-core");
const request = require("request");
const fs = require("fs");
const getYouTubeID = require("get-youtube-id");
const fetchVideoInfo = require("youtube-info");

// Include settings.json
var config = JSON.parse(fs.readFileSync("./settings.json", "utf-8").substring(1));

const yt_api_key = config.yt_api_key;
const bot_controller = config.bot_controller;
const prefix = config.prefix;
const discord_token = config.discord_token;

var guilds = {};

// Start the bot
client.login(discord_token);

client.on("message", function(message) {
  const member = message.member;
  const mess = message.content.toLowerCase();
  const args = message.content.split(" ").slice(1).join(" ");

  // Make bot work on multiple servers at once
  if (!guilds[message.guild.id]) {
    guilds[message.guild.id] = {
      queue: [],
      queueNames: [],
      isPlaying: false,
      dispatcher: null,
      VoiceChannel: null,
      skipReq: 0,
      skippers: []
    };
  }

  // Play Command
  if (mess.startsWith(prefix + "play")) {
    // Check if user is in a voice channel
    if (message.member.voiceChannel || guilds[message.guild.id].voiceChannel != null) {
      // Check if the queue is greater than 0 or if the bot is playing music
      if (guilds[message.guild.id].queue.length > 0 || guilds[message.guild.id].isPlaying) {
        getID(args, function(id) {
          add_to_queue(id, message); // Add the song to queue
          fetchVideoInfo(id, function(err, videoInfo) {
            if (err) throw new Error(err);
            guilds[message.guild.id].queueNames.push(videoInfo.title);  // Add the reuqested song to queue
            message.reply("Added To Queue **" + videoInfo.title + "!**");
          });
        });
      }
      // Push all queued songs up 1 in the queue
      else {
        isPlaying = true;
        getID(args, function(id) {
          guilds[message.guild.id].queue.push(id);
          PlayMusic(id, message);
          fetchVideoInfo(id, function(err, videoInfo) {
            if (err) throw new Error(err);
            guilds[message.guild.id].queueNames.push(videoInfo.title);
            message.reply("Now Playing **" + videoInfo.title + "!**");
          });
        });
      }
    }
    else {
      message.reply("You must be in a voice channel first!");
    }
  }

  // Skip Command
  else if (mess.startsWith(prefix + "skip")) {
    skip_song(message);
    message.reply("Skipped Song!");
  }

  // Leave Command
  else if (mess.startsWith(prefix + "leave")) {
    // Check if user is in the same voice channel as the bot
    if (message.member.voiceChannel !== message.guild.me.voiceChannel) {
      return message.channel.send("You need to be in the same voice channel as the bot!");
    }

    // Leave the voice channel
    if (message.member.voiceChannel || guilds[message.guild.id].voiceChannel != null) {
      guilds[message.guild.id].queue.length = 0; // Set queue length to 0
      guilds[message.guild.id].dispatcher.isPlaying = false; // stop playing music
      guilds[message.guild.id].dispatcher.pause = true;
      guilds[message.guild.id].dispatcher.end(); // End the song
      guilds[message.guild.id].voiceChannel.leave(); // Leave the voice channel
    }
    else {
      message.channel.send("I must be in a voice channel first to leave!");
      return;
    }
  }

  // Queue Command
  else if (mess.startsWith(prefix + "queue")) {
    // Check if user is in the same voice channel as the bot
    if (message.member.voiceChannel !== message.guild.me.voiceChannel) {
      return message.channel.send("You need to be in the same voice channel as the bot!");
    }

    // Check if there are any queued songs
    if (guilds[message.guild.id].queueNames.length <= 0) {
      message.channel.send("No songs in queue!");
      return;
    }

    // Put the queue in a nice embed
    for (var i = 0; i < guilds[message.guild.id].queueNames.length; i++) {
      var temp = i + 1 + ": " + guilds[message.guild.id].queueNames[i] + (i === 0 ? " **(Current Song)**" : "") + "\n";

      // embed
      var embed = new Discord.RichEmbed()
        .setTitle("Song Queue")
        .setColor("RANDOM")
        .setDescription(temp);

      message.channel.send(embed);
    }
  }

  // Pause Command
  else if (mess.startsWith(prefix + "pause")) {
    // Check if user is in the same voice channel as the bot
    if (message.member.voiceChannel !== message.guild.me.voiceChannel) {
      return message.channel.send("You need to be in the same voice channel as the bot!");
    }

    // Check if there are any songs in the queue
    if (guilds[message.guild.id].queueNames.length <= 0) {
      message.channel.send("No songs in queue to pause!");
      return;
    }

    // Pause the song
    // Check if the bot is in a voice channel
    if (message.member.voiceChannel || guilds[message.guild.id].voiceChannel != null) {
      guilds[message.guild.id].dispatcher.pause();
      message.channel.send(":pause_button: Song Paused!");
    }
    else {
      message.channel.send("I need to be in the voice channel to pause music!");
    }
  }

  // Resume Command
  else if (mess.startsWith(prefix + "resume")) {
    // Check if user is in the same voice channel as the bot
    if (message.member.voiceChannel !== message.guild.me.voiceChannel) {
      return message.channel.send("You need to be in the same voice channel as the bot!");
    }

    // Check if there are any songs in the queue
    if (guilds[message.guild.id].queueNames.length <= 0) {
      message.channel.send("No songs in queue to resume playing!");
      return;
    }

    // Resume the song
    // Check if the bot is in a voice channel
    if (message.member.voiceChannel || guilds[message.guild.id].voiceChannel != null) {
      guilds[message.guild.id].dispatcher.resume(); // Resume the song 
      message.channel.send(":arrow_forward: Song Resumed!");
    }
    else {
      message.channel.send("I need to be in a voice channel to resume music!");
    }
  }

  // Stop Command
  else if (mess.startsWith(prefix + "stop")) {
    // Check if user is in the same voice channel as the bot
    if (message.member.voiceChannel !== message.guild.me.voiceChannel) {
      return message.channel.send("You need to be in the same voice channel as the bot!");
    }

    // Check if the queue is empty
    if (guilds[message.guild.id].queueNames.length <= 0) {
      message.channel.send("No songs in queue to stop!");
      return;
    }

    // Stop the music
    // Check if the bot is in a voice channel
    if (message.member.voiceChannel || guilds[message.guild.id].voiceChannel != null) {
      guilds[message.guild.id].queue.length = 0; // Remove every song from the queue
      guilds[message.guild.id].dispatcher.end(); // End the song
      message.channel.send("Music stopped!");
    }
    else {
      message.channel.send("I need to be in a voice channel to stop music!");
      return;
    }
  }

  // Volume Command
  else if (mess.startsWith(prefix + "volume")) {
    // Check if the user is in the same voice channel as the bot
    if (message.member.voiceChannel !== message.guild.me.voiceChannel) {
      return message.channel.send("You need to be in the same voice channel as the bot!");
    }

    // Another args because I am lazy
    const args1 = message.content.split(" ").slice(1);

    // Check if the user input is between 0 and 200
    if (isNaN(args1[0]) || args1[0] > 200 || args1[0] < 0) {
      return message.channel.send("Please input a number between 0 - 200");
    }

    var volume = args1[0] / 200; // Divide the user input by 200
    guilds[message.guild.id].dispatcher.setVolume(volume); // Set the volume
    message.channel.send(`Volume set to ${volume * 100}%`); // Times the divided number 100 to get a percentage
  }

  // Help Command
  else if (mess.startsWith(prefix + "help")) {
    var embed = new Discord.RichEmbed()
      .setColor("RANDOM")
      .setAuthor("Help Commands")
      .setTitle("Using the prefix ')'")
      .setThumbnail("https://i.imgur.com/CWHCGJB.png")
      .setDescription("**Play:** Plays a song via YouTube search.\n**Queue:** Prints the current song queue.\n**Skip:** Skips the song playing.\n**Pause:** Pauses the song playing.\n**Resume:** Resumes the song that was paused.\n**Stop:** Stops the queue.\n**Leave:** Leaves the voice channel.\n**Volume:** Sets the songs volume to a set number.\n");

    message.channel.send(embed);
  }
});

// Changing bot status
function ChangingBotStatus() {
  let Statuses = [
    "September - Earth, Wind & Fire",
    "Africa - Toto",
    "Hold The Line - Toto",
    "All Star - Smash Mouth",
    "Rosanna - Toto",
    "Rocket Man - Elton John",
    "I'm A Believer - Smash Mouth",
    "Boney M. - Rasputin",
    "Tri Poloski - Bunch Of Slavs",
    "Sympathy For The Devil - The Rolling Stones",
    "Bohemian Rhapsody - Queen",
    "LOVE. - Kendrick Lamar",
    "Collard Greens - ScHoolboy Q, Kendrick Lamar",
    "DNA. - Kendrick Lamar",
    "I Fall Apart - Post Malone",
    "Congratulations - Post Malone, Quavo",
    "Psycho (feat. Ty Dolla $ign)",
    "Element - Kendrick Lamar",
    "Humble - Kendrick Lamar",
    "Loyalty. Feat. Rihanna - Kendrick Lamar, Rihanna"
  ];
  let RandomStatus = Statuses[Math.floor(Math.random() * Statuses.length)]; // Grab a random song from the array
  client.user.setActivity(RandomStatus); // Set the song status
}

client.on("ready", function() {
  setInterval(ChangingBotStatus, 240000); // Set the random song status every 4 minutes
  console.log("I am working (kinda)."); // Log if the bot is working
});

// Play Music
function PlayMusic(id, message) {
  guilds[message.guild.id].voiceChannel = message.member.voiceChannel;

  guilds[message.guild.id].voiceChannel.join().then(function(connection) {
    stream = ytdl("https://www.youtube.com/watch?v=" + id, {
      filter: "audioonly" // Filter out video for better streaming
    });
    guilds[message.guild.id].skipReq = 0;
    guilds[message.guild.id].skippers = [];

    guilds[message.guild.id].dispatcher = connection.playStream(stream);
    guilds[message.guild.id].dispatcher.on("end", function() {
      guilds[message.guild.id].skipReq = 0;
      guilds[message.guild.id].skippers = [];
      guilds[message.guild.id].queue.shift();
      guilds[message.guild.id].queueNames.shift();
      if (guilds[message.guild.id].queue.length === 0) {
        guilds[message.guild.id].queue = [];
        guilds[message.guild.id].queueNames = [];
        guilds[message.guild.id].isPlaying = false;
      } else {
        setTimeout(function() {
          PlayMusic(guilds[message.guild.id].queue[0], message);
        }, 500);
      }
    });
  });
}

// Skip Song
function skip_song(message) {
  guilds[message.guild.id].dispatcher.end();
}

// Get Youtube video ID
function getID(str, callback) {
  if (isYouTube(str)) {
    callback(getYouTubeID(str));
  } else {
    search_video(str, function(id) {
      callback(id);
    });
  }
}

// Add Song to queue
function add_to_queue(strID, message) {
  if (isYouTube(strID)) {
    guilds[message.guild.id].queue.push(getYouTubeID(str));
  } else {
    guilds[message.guild.id].queue.push(strID);
  }
}

// Search for the user input
function search_video(query, callback) {
  request("https://www.googleapis.com/youtube/v3/search?part=id&type=video&q=" + encodeURIComponent(query) + "&key=" + yt_api_key,
    function(error, response, body) {
      var json = JSON.parse(body);
      if (!json.items[0]) callback("jAUXTl6fGVM");
      else {
        callback(json.items[0].id.videoId);
      }
    }
  );
}

function isYouTube(str) {
  return str.toLowerCase().indexOf("youtube.com") > -1;
}
