const Discord = require("discord.js");
const { prefix, token } = require("./config.json");
const ytdl = require("ytdl-core");
const { exec } = require("child_process");
const fs = require('fs');

const client = new Discord.Client();

const queue = new Map();

//Impostazioni di default
var NumCar = "20";
var VelCW = "12";
var NotaCW = "800";
var WordLen = 5;
var Lettere = "abc";

//Variabili utili
var RiproduzioneAttiva = false;
var LettereOUT = "VVVVV ";
var staiZitto = false;
var primoCiclo = true;
var ultimoMsg;

client.once("ready", () => {
  //Connessione alla chat riuscita (guild)
  console.log("Pronto a trasmettere CW!");
});

client.once("reconnecting", () => {
  //Errore di connessione
  console.log("Errore di connessione!");
});

client.once("disconnect", () => {
  console.log("Disconnessione!");
});

client.on("message", async message => {
  //Viene ricevuto un messaggio dalla chat
  if (message.author.bot) return;
  //Controlla come inizia il messaggio ed agisci se ha il "prefix"
  if (!message.content.startsWith(prefix)) return;

  const serverQueue = queue.get(message.guild.id);

  //Controllo il testo ricevuto
  if (message.content.startsWith(`${prefix}morse`)) {
    //Ho ricevuto un PLAY 
    if (!RiproduzioneAttiva) {
    if(aggiornaImpostazioni(message)) {
      ultimoMsg = message;
      execute(message, serverQueue);
    }
  } else {
    message.channel.send("Ehi, fammi finire una cosa alla volta!");
  }
    return;
  } else if (message.content.startsWith(`${prefix}mstop`)) {
    stop(serverQueue, message);
    return;
  } else if (message.content.startsWith(`${prefix}mhelp`)) {
    msgHelp(message);
    return;
  } /* else if (message.content.startsWith(`${prefix}msame`)) {
    if (!primoCiclo) {
      playSame(message);
    } else {
      message.channel.send("Mmm, non mi ricordo l'ultima sequenza, forse non l'hai ancora generata?");
    }
    return;
  } */ else if (message.content.startsWith(`${prefix}mrpt`)) {
    if (!RiproduzioneAttiva) {
      if (!primoCiclo) {
        execute(ultimoMsg, serverQueue);
      } else {
        message.channel.send("Mmm, non mi ricordo l'ultima sequenza, forse non l'hai ancora generata?");
      }
      return;
    } else {
      message.channel.send("Si ma dammi un attimo!");
    }
    } else {
    //message.channel.send("Comando non riconosciuto!");
  }
});

function isLetter(testo) {
  //Controllo che le lettere inserite siano comprese tra A e Z
  var lettera = false;
  var tempChar = "";
  for (var i=0; i<testo.length; i++) {
    //Estraggo una lettera alla volta
    tempChar=testo.charAt(i);
    //Controllo che sia una lettera
    if(tempChar.toUpperCase() == tempChar.toLowerCase()) {
      lettera=true;
    } else {
      //Se non lo è interrompo il ciclo e blocco l'esecuzione
      lettera = false;
      break;
    }
  }
  return lettera
}

function aggiornaImpostazioni(message) {
  //Assegnazione dei valori inviati tramite messaggio, eseguito solo con comando !morse
  const args = message.content.split(" ");
  Lettere = args[1];

  if (Lettere=="") {
    //Se non ho specificato le lettere nel primo comando fermo l'esecuzione
    message.channel.send("Errore! Devi specificare le lettere da usare!");
    return 0;
  } else {
    if(isLetter(Lettere)) {
      //Controllo che le lettere siano corrette
      message.channel.send("Errore! Hai usato caratteri non ammessi!");
      return 0;
    }
  }
  if (args[2] && args[2]!="") {
    //Aggiornamento del numero di caratteri da generare
    NumCar = args[2];
    console.log("NumCar: "+NumCar);
  }
  if (args[3] && args[3]!="") {
    //Aggiornamento della velocità in WPM
    VelCW = args[3];
    console.log("VelCw: "+VelCW);
  }
  if (args[4] && args[4]!="") {
    //Aggiornamento della frequenza della nota
    NotaCW = args[4];
    console.log("NotaCW :"+NotaCW);
  }
  if (args[5] && args[5]!="") {
    //Aggiornamento della lunghezza delle word
    WordLen = args[5];
    console.log("WordLen: "+WordLen);
  }
  if (WordLen > NumCar) {
    NumCar = WordLen;
    message.channel.send("Numero caratteri impostato a "+NumCar);
  }
  return 1;
}

function ctrlCondizioni(message, serverQueue) {
  //Riporta errore se non sono connesso ad un canale vocale
  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel) {
    message.channel.send("Errore! Devi prima entrare in un canale vocale!");
    return 1
  }

  const permissions = voiceChannel.permissionsFor(message.client.user);
  if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
    message.channel.send("Ehi! Non mi hai dato i permessi per parlare!");
    return 2
  }

  return 0
}

function msgHelp(message) {
  if (ctrlCondizioni(message)==0) {
    message.channel.send(
      "--- INFORMAZIONI SUL BOT ---\n\n"+
      "- Per iniziare la lezione, digitare il comando !morse seguito dalle lettere, ad esempio il comando:\n"+
      "  !morse abc\n"+
      "  farà iniziare una sequenza di codice morse con le sole lettere A, B e C con i parametri di default\n"+
      "  ovvero: 20 caratteri, 12 WPM, nota a 800Hz e gruppi da 5 caratteri\n\n"+
      "- Per modificare le impostazioni del codice generato si possono aggiungere altre opzioni, ovvero:\n"+
      "  !morse abc 25 \n"+
      "  Creerà una sequenza di 25 caratteri\n"+
      "  !morse abc 30 15\n"+
      "  Creerà una sequenza di 30 caratteri alla velocità di 15 WPM\n"+
      "  !morse abc 15 13 1000\n"+
      "  Creerà una sequenza di 15 caratteri alla velocità di 13 WPM e con la nota a 1000Hz\n"+
      "  !morse abc 20 12 800 4\n"+
      "  Creerà una sequenza di 20 caratteri alla velocità di 12 WPM, con la nota a 800Hz contenente gruppi di 4 lettere\n\n"+
      "- Per fermare la riproduzione della stringa in corso:\n"+
      "  !mstop\n\n"+
      "- Per visualizzare questo messaggio:\n"+
      "  !mhelp\n\n"+
      "- Per generare un'altra sequenza con le stesse impostazioni:\n"+
      "  !mrpt"+
      "  \n\n"+
      "--- Fine della descrizione del bot ---"
    );
  }
}

function generaSequenza(lun, car) {
  var result = "";
  var charLen = car.length;

  for (var i=0; i<lun; i++) {
    result += car.charAt(Math.floor(Math.random() * charLen));
  }
  return result;
}

async function execute(message, serverQueue) {
  const voiceChannel = message.member.voice.channel;

  if (!RiproduzioneAttiva) {
    RiproduzioneAttiva=true;

    const song = {
      title: 'Morse Code',
      url: 'sample'
    };

    const queueContruct = {
      textChannel: message.channel,
      voiceChannel: voiceChannel,
      connection: null,
      songs: [],
      volume: 5,
      playing: true
    };

    queue.set(message.guild.id, queueContruct);
    queueContruct.songs.push(song);

    try {
      var connection = await voiceChannel.join();
      var NumCicli;
      queueContruct.connection = connection;
      //message.channel.send("Inizio della trasmissione del beacon")
      //play(message.guild, queueContruct.songs[0]);

      //Creazione dei gruppi di lettere, calcolo quanti cicli di FOR fare
      if (WordLen>0) {
        NumCicli = Math.floor(NumCar / WordLen);
        if (NumCicli<1) {
          NumCicli=1;
          message.channel.send("Hai creato una combinazione impossibile, applico la correzione automatica");
        }
      } else {
        NumCicli=1;
        message.channel.send("Hai creato una combinazione impossibile, applico la correzione automatica");
      }
      
      LettereOUT = "VVVVV ";
      for (var i =0; i<NumCicli; i++) {
        LettereOUT+=generaSequenza(WordLen, Lettere)+" ";
      }

      //Creazione del file di testo da convertire in CW
      fs.writeFileSync("/tmp/testo.txt", LettereOUT, (err) => {
        if(err) {
          return message.channel.send("Errore FS: "+err);
        }
      });

      //Creazione del processo per generare il CW
      const StringaCom = "ebook2cw -w "+VelCW+" -f "+NotaCW+" -T SINE -o /tmp/TestoCW /tmp/testo.txt";
      exec(StringaCom, (error, stdout, stderr) => {
      if (error) {
        return message.channel.send("Errore: "+error.message);
      } if (stderr) {
        return message.channel.send("STDErr: "+stderr);
      }
      console.log(stdout);
    });

    //Riproduzione del file generatao
    play(message.guild, message, LettereOUT);
    //message.channel.send("Testo: "+LettereOUT.toUpperCase());

    } catch (err) {
      console.log(err);
      queue.delete(message.guild.id);
      return message.channel.send(err);
    }
  } else {
    //serverQueue.songs.push(song);
    return message.channel.send("Sto già eseguendo una sequenza, devi prima fermarla con !mstop");
  }
}

function stop(serverQueue, message) {
  if (!message.member.voice.channel) {
    message.channel.send("Devi essere in un canale vocale per fermare la musica!");
    return
  }

  if (RiproduzioneAttiva) {
    serverQueue.connection.dispatcher.end();
    serverQueue.songs = [];
    
    RiproduzioneAttiva=false;
    message.channel.send("OK! Me ne torno nel mio coud...");
    staiZitto=true;
  } else {
    message.channel.send("Ehi! Non sto facendo nulla!");
  }
  return
}

function play(guild, message, testo) {
  const serverQueue = queue.get(guild.id);
  primoCiclo=false;

  const dispatcher = serverQueue.connection
    .play('/tmp/TestoCW0000.mp3')
    .on("finish", () => {
      //return message.channel.send("Fine del messaggio CW");
      serverQueue.voiceChannel.leave();
      //queue.delete(guild.id);
      RiproduzioneAttiva=false;
      if (staiZitto) {
        staiZitto=false;
      } else {
        message.channel.send("Testo: "+testo.toUpperCase());
      }
      return
    })
    .on("error", error => console.error(error));
  dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
}

client.login(token);