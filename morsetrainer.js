//Librerie necessarie per il funzionamento
//const Discord = require("discord.js");
const { Client, GatewayIntentBits, Events } = require('discord.js');
// Metti qui config.json se necessario, a volte mi dimentico di sistemare
const { prefix, token } = require("./secrets.json");
const ytdl = require("ytdl-core");
const { exec } = require("child_process");
const fs = require('fs');
const { createAudioResource, createAudioPlayer, joinVoiceChannel, getVoiceConnection, entersState, VoiceConnectionStatus } = require('@discordjs/voice');

//Inizializzazione librerie discord
//const client = new Discord.Client();
const client = new Client({
    intents: [
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
    ]
});
const queue = new Map();

//Impostazioni di default
var NumCar = "20";
var VelCW = "12";
var NotaCW = "800";
var WordLen = 5;
var Lettere = "abc";
var spazCar = 0;
var spazPar = 1;
var LettereOUT;
var argIniziale = 1;

//Variabili utili
var RiproduzioneAttiva = false; // Sto già riproducendo un messaggio
var staiZitto = false; // Controllo se lo stop viene da un comando o se ho finito il messaggio
var primoCiclo = true; // Non posso usare MRPT se non ho usato il !morse almeno una volta 
var ultimoMsg; // Copia del ultimo messaggio ricevuto
var messaggioQ = false; // Devo inviare i codici Q o un testo?
var parole = false; // Devo inviare parole di senso compiuto?
var callsign = false; // Devo inviare callsign?
var parEng = false; //Parole in inglese

// Array di codice Q da inviare - abbreviazioni maggiormente utilizzate
const codiceQ = [
    "QRA", "QRB", "QRG", "QRH", "QRI", "QRK", "QRL", "QRM", "QRN", "QRO", "QRP", "QRQ", "QRS",
    "QRT", "QRU", "QRV", "QRX", "QRZ", "QSA", "QSB", "QSD", "QSK", "QSL", "QSM", "QSN", "QSO",
    "QSS", "QSX", "QSY", "QTC", "QTH", "QTR"
];

const aryAlfabeto = [
    "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k",
    "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v",
    "w", "x", "y", "z"
];

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

client.on(Events.MessageCreate, async message => {
    //console.log("Ricevuto: " + message.content)
    // Viene ricevuto un messaggio dalla chat
    if (message.author.bot) return;
    // Controlla come inizia il messaggio ed agisci se ha il "prefix"
    if (!message.content.startsWith(prefix)) return;
    console.log("Elaborazione del comando [" + message.content + "]")
    const serverQueue = queue.get(message.guild.id);

    // Controllo il testo ricevuto
    if (message.content.startsWith(`${prefix}morse`)) {
        // Ho ricevuto un PLAY 
        if (!RiproduzioneAttiva) {
            NumCar = "20";
            messaggioQ = false;
            parole = false;
            parEng = false;
            argIniziale = 2;
            // Eseguo il comando solamente se non sto già riproducendo altro
            if (aggiornaImpostazioni(message)) {
                // La variabile ultimoMsg mi server come appoggio per poter
                // ripetere l'ultimo comando eseguito nel blocco !mrpt
                ultimoMsg = message;
                execute(message, serverQueue);
            }
        } else {
            // Se sto già riproducendo una sequenza mostra un errore
            message.channel.send("Ehi, fammi finire una cosa alla volta!");
        }
        return;
    } else if (message.content.startsWith(`${prefix}mstop`)) {
        // Blocca la riproduzione
        stop(serverQueue, message);
        return;
    } else if (message.content.startsWith(`${prefix}mhelp`)) {
        // Mostra il messaggio di aiuto
        msgHelp(message);
        return;
    } else if (message.content.startsWith(`${prefix}mmsg`)) {
        if (!primoCiclo) {
            // Re invio l'ultimo comando ricevuto
            message.channel.send(ultimoMsg);
            return;
        } else {
            message.channel.send("Che ti ripeto se non mi hai mandato nulla?");
        }
    } else if (message.content.startsWith(`${prefix}mkill`)) {
        //Uccido il BOT in caso di problemi
        botKill(message);
        return;
    } else if (message.content.startsWith(`${prefix}mq`)) {
        if (!RiproduzioneAttiva) {
            // Genera codice Q con parametri di default
            messaggioQ = true;
            parole = false;
            callsign = false;
            parEng = false;
            NumCar = "5";
            VelCW = "12";
            NotaCW = "800";
            WordLen = 5;
            Lettere = "";
            argIniziale = 1;
            // A meno che non ne vengano inserite di più
            if (aggiornaImpostazioni(message)) {
                ultimoMsg = message;
                execute(message, serverQueue);
            }
        } else {
            message.channel.send("Senti, sto già facendo altro, ok?");
        }
        return;
    } else if (message.content.startsWith(`${prefix}mpar`)) {
        if (!RiproduzioneAttiva) {
            // Genera codice Q con parametri di default
            messaggioQ = false;
            parole = true;
            callsign = false;
            parEng = false;
            NumCar = "5";
            VelCW = "12";
            NotaCW = "800";
            WordLen = 5;
            Lettere = "";
            argIniziale = 1;
            // A meno che non ne vengano inserite di più
            if (aggiornaImpostazioni(message)) {
                ultimoMsg = message;
                execute(message, serverQueue);
            }
        } else {
            message.channel.send("Senti, sto già facendo altro, ok?");
        }
        return;
    } else if (message.content.startsWith(`${prefix}meng`)) {
        if (!RiproduzioneAttiva) {
            // Genera codice Q con parametri di default
            messaggioQ = false;
            parole = false;
            callsign = false;
            parEng = true;
            NumCar = "5";
            VelCW = "12";
            NotaCW = "800";
            WordLen = 5;
            Lettere = "";
            argIniziale = 1;
            // A meno che non ne vengano inserite di più
            if (aggiornaImpostazioni(message)) {
                ultimoMsg = message;
                execute(message, serverQueue);
            }
        } else {
            message.channel.send("Senti, sto già facendo altro, ok?");
        }
        return;
    } else if (message.content.startsWith(`${prefix}mcall`)) {
        if (!RiproduzioneAttiva) {
            // Genera codice Q con parametri di default
            messaggioQ = false;
            parole = false;
            callsign = true;
            NumCar = "5";
            VelCW = "12";
            NotaCW = "800";
            WordLen = 5;
            Lettere = "";
            argIniziale = 1;
            // A meno che non ne vengano inserite di più
            if (aggiornaImpostazioni(message)) {
                ultimoMsg = message;
                execute(message, serverQueue);
            }
        } else {
            message.channel.send("Senti, sto già facendo altro, ok?");
        }
        return;
    } else if (message.content.startsWith(`${prefix}mrpt`)) {
        if (!RiproduzioneAttiva) {
            if (!primoCiclo) {
                argIniziale = 1;
                // Controllo se qualcuno ha richiesto dei modificatori
                aggiornaImpostazioni(message);
                // Genero una nuova sequenza con gli ultimi parametri usati
                execute(ultimoMsg, serverQueue);
            } else {
                // Nel caso in cui non sia ancora stata generata una sequenza riporto l'errore
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
    // Controllo che le lettere inserite siano comprese tra A e Z
    // !!! Allo stato attuale il codice presenta un errore, inviando
    // "!morse 1" l'esecuzione si ferma mostrando l'errore che non contiene caratteri
    // mentre inviando "!morse 1a" il codice cicla normalmente nonostante il "break"
    var lettera = false;
    var tempChar = "";
    for (var i = 0; i < testo.length; i++) {
        // Estraggo una lettera alla volta
        tempChar = testo.charAt(i);
        // Controllo che sia una lettera
        if (tempChar.toUpperCase() == tempChar.toLowerCase()) {
            lettera = true;
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

    if (argIniziale == 2) {
        //Scelta del valore iniziale a seconda del comando ricevuto
        Lettere = args[1];
        try {
            if (Lettere.length < 1) {
                //Se non ho specificato le lettere nel primo comando fermo l'esecuzione
                message.channel.send("Errore! Devi specificare le lettere da usare!");
                return 0;
            }
        } catch (Exc) {
            if (Exc instanceof TypeError && Exc.message.includes("Cannot read properties of undefined")) {
                message.channel.send("Errore! Devi specificare le lettere da usare!");
                return 0
            } else {
                message.channel.send(Exc.message)
                return 0
            }
        }
        if (isLetter(Lettere)) {
            //Controllo che le lettere siano corrette
            message.channel.send("Errore! Hai usato caratteri non ammessi!");
            return 0;
        } else if (Lettere == "lettere") {
            //Genero tutte le lettere con un solo comando
            Lettere = "abcdefghijklmnopqrstuvwxyz";
        } else if (Lettere == "numeri") {
            //Genero tutti i numeri con un comando
            Lettere = "0123456789";
        }
    }

    if (args.length > argIniziale) {
        var valModif;
        for (var i = argIniziale; i < args.length; i++) {
            var stringModif = args[i];
            var argomModif = stringModif.substring(0, 1);
            argomModif = argomModif.toLowerCase();
            valModif = stringModif.substring(1, stringModif.length);

            if (argomModif != "+" & valModif < 0) {
                message.channel.send("MA CHE OOOOOOOOOOOH!!!");
                valModif = Math.floor(Math.random() * 100);
            }

            switch (argomModif) {
                case "c":
                    //Aggiornamento dei caratteri da generare
                    NumCar = valModif;
                    break;
                case "v":
                    //Aggiornamento della velocità del testo generato
                    VelCW = valModif;
                    break;
                case "f":
                    //Aggiornamento frequenza della nota
                    NotaCW = valModif;
                    break;
                case "w":
                    //Aggiornamento frequenza del numero di caratteri per word
                    WordLen = valModif;
                    break;
                case "s":
                    //Aggiornamento spaziatura tra caratteri
                    spazCar = valModif
                    break;
                case "p":
                    //Aggiornamento spaziatura tra parole
                    spazPar = valModif
                    break;
                case "+":
                    //Aggiunta lettere all'ultima stringa
                    //if (isLetter(tempStr)) {
                    Lettere = Lettere + valModif;
                    break;
                //    break;
                //} else {
                //    message.channel.send("Errore, inserisci solo lettere!");
                //    return 0;
                //}
                default:
                    //Stringa non riconosciuta
                    message.channel.send("Mi dispiace ma non ho capito! Parametro sconosciuto: " + stringModif);
                    return 0;
            }
            console.log("Parametro ricevuto: " + stringModif + " Modificatore: " + argomModif + " Valore: " + stringModif.substring(1, stringModif.length));
        }
    }

    // Numero di caratteri fuori intervallo ammesso
    if (NumCar < 1) {
        NumCar = 5;
    } else if (NumCar > 100) {
        NumCar = 100;
    }

    // Problema con numero caratteri e sequenze
    if (WordLen > NumCar) {
        NumCar = WordLen;
        message.channel.send("Numero caratteri impostato a " + NumCar);
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

    //Controllo di avere i permessi per parlare
    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
        message.channel.send("Ehi! Non mi hai dato i permessi per parlare!");
        return 2
    }

    return 0
}

function msgHelp(message) {
    // Informazioni di aiuto per gli utenti
    message.channel.send(
        "- Per iniziare la lezione, digitare il comando !morse seguito dalle lettere, ad esempio, per iniziare una sequenza di codice morse con le sole lettere A, B e C con i parametri di default (20 caratteri, 12 WPM, nota a 800Hz e gruppi da 5 caratteri):" +
        "```!morse abc```\n\n" +
        "- Per modificare le impostazioni del codice generato si possono aggiungere altre opzioni, ad esempio per creareuna sequenza di 25 caratteri:" +
        "```!morse abc c25```\n\n" +
        "- Per creare una sequenza di 30 caratteri alla velocità di 15 WPM:" +
        "```!morse abc c30 v15```\n\n" +
        "- Per creare una sequenza di 15 caratteri alla velocità di 13 WPM e con la nota a 1000Hz:" +
        "```!morse abc v13 c15 f1000```\n\n" +
        "- Per creare una sequenza alla velocità di 13 WPM e con spaziatura tra le lettere di 2 punti:" +
        "```!morse abc v13  s2```\n\n" +
        "- Per creare una sequenza con spaziatura tra le lettere di 2 punti e spaziatura tra le parole di 3 punti:" +
        "```!morse abc p3  s2```\n\n" +
        "- Per creare una sequenza di 20 caratteri alla velocità di 12 WPM, con la nota a 800Hz contenente gruppi di 4 lettere:" +
        "```!morse abc f800 c20 v12 w4```\n\n" +
        "- Per creare una sequenza con tutte le lettere dell'alfabeto:" +
        "```!morse lettere```\n\n" +
        "- Per creare una sequenza di soli numeri:" +
        "```!morse numeri```"
    );
    message.channel.send(
        "- Per generare una sequenza di codice Q:" +
        "```!mq```\n\n" +
        "- Genera una sequenza di codice Q tra quelle magiormente utilizzate (default 5 parole), per modificare le opzioni:" +
        "```!mq c10```\n\n" +
        "- Genera una sequenza di 10 codici Q con le impostazioni di default (12 WPM e nota a 800Hz)" +
        "```!mq c7 v10```\n\n" +
        "- Genera una sequenza di 7 codici Q alla velocità di 10 WPM" +
        "```mq c8 v10 f1000```\n\n" +
        "- Genera una sequenza di 8 codici Q alla velocità di 10 WPM e con nota a 1000Hz" +
        "- Per generare una serie di parole di senso compiuto (i modificatori - numero parole, velocità, ecc - sono gli stessi usati per il comando del codice Q):" +
        "```mpar```\n\n" +
        "- Per generare una serie di parole inglesi di senso compiuto (i modificatori - numero parole, velocità, ecc - sono gli stessi usati per il comando del codice Q):" +
        "```meng```\n\n" +
        "- Per generare una serie di callsign (i modificatori - numero parole, velocità, ecc - sono gli stessi usati per il comando del codice Q):" +
        "```mcall```\n\n" +
        "- Per fermare la riproduzione della stringa in corso:" +
        "```mstop```\n\n" +
        "- Per visualizzare questo messaggio:" +
        "```mhelp```\n\n" +
        "- Per generare un'altra sequenza con le stesse impostazioni:" +
        "```mrpt```\n\n" +
        "- L'ultima sequenza può anche essere modificata con gli stessi parametri del comando `!morse`, ad esempio, per generare una sequenza uguale alla precedente ma modificandone la velocità:" +
        "```mrpt v20```\n\n" +
        "- Per visualizzare l'ultimo messaggio inviato:" +
        "```mmsg```\n\n" +
        "- Per riavviare il BOT in caso di problemi:" +
        "```mkill```"
    );
}

function generaSequenza(lun, car) {
    // Generazione sequenza casuale di caratteri tra quelli ricevuti
    var result = "";
    var charLen = car.length;

    for (var i = 0; i < lun; i++) {
        result += car.charAt(Math.floor(Math.random() * charLen));
        if (spazCar > 0) {
            for (var j = 1; j <= spazCar; j++) {
                result += " ";
            }
        }
    }
    return result;
}

async function execute(message) {
    console.log("Inizio generazione sequenza");

    if (!RiproduzioneAttiva) {
        RiproduzioneAttiva = true;
        var NumCicli;

        // Inizializzo la stringa da generare
        LettereOUT = "VVVVV ";
        app_LettereOUT = LettereOUT;

        if (parole) {
            console.log("Generazione di parole italiane");
            // Genero "n" parole da un file di testo
            fs.readFile('./parole.txt', function (err, data) {
                data += '';
                if (err) throw err;
                var lines = data.split('\n');
                for (var i = 0; i < NumCar; i++) {
                    LettereOUT += lines[Math.floor(Math.random() * lines.length)] + " ";
                }
                ConvertAndPlay(message);
            })
        } else if (parEng) {
            console.log("Generazione di parole inglesi");
            // Genero "n" parole da un file di testo
            fs.readFile('./words.txt', function (err, data) {
                data += '';
                if (err) {
                    message.channel.send(err.content);
                    throw err;
                } 
                var lines = data.split('\n');
                for (var i = 0; i < NumCar; i++) {
                    LettereOUT += lines[Math.floor(Math.random() * lines.length)] + " ";
                }
                console.log("Generato: " + LettereOUT);
                ConvertAndPlay(message);
            })
        } else if (messaggioQ) {
            for (var i = 0; i < NumCar; i++) {
                qLen = codiceQ.length;
                // Genero "n" blocchi di codice Q
                LettereOUT += codiceQ[(Math.floor(Math.random() * qLen))] + " ";
            }
            ConvertAndPlay(message);
        } else if (callsign) {
            fs.readFile('./callsign.txt', function (err, data) {
                data += '';
                if (err) throw err;
                var lines = data.split('\n');
                for (var i = 0; i < NumCar; i++) {
                    LettereOUT += lines[Math.floor(Math.random() * lines.length)] + " ";
                }
                ConvertAndPlay(message);
            })

        } else {
            //Creazione dei gruppi di lettere, calcolo quanti cicli di FOR fare ed eventuali correzioni
            if (WordLen > 0) {
                NumCicli = Math.floor(NumCar / WordLen);
                if (NumCicli < 1) {
                    NumCicli = 1;
                    message.channel.send("Hai creato una combinazione impossibile, applico la correzione automatica");
                }
            } else {
                NumCicli = 1;
                message.channel.send("Hai creato una combinazione impossibile, applico la correzione automatica");
            }

            for (var i = 0; i < NumCicli; i++) {
                // Genero "n" blocchi di caratteri per la mia sequenza
                LettereOUT += generaSequenza(WordLen, Lettere);
                for (var j = 1; j <= spazPar; j++) {
                    LettereOUT += " ";
                }
            }
            ConvertAndPlay(message);
        }
    } else {
        // Se sto già eseguendo un comando riporto un errore
        message.channel.send("Sto già eseguendo una sequenza, devi prima fermarla con !mstop");
        return
    }
}

async function ConvertAndPlay(message) {
    try {
        //Creazione del file di testo da convertire in CW
        console.log("Scrittura di: " + LettereOUT);
        fs.writeFileSync("/tmp/testo.txt", LettereOUT, (err) => {
            if (err) {
                // Errore di scrittura del file
                message.channel.send("Errore FS: " + err);
                return
            }
        });

        //Creazione del processo per generare il CW
        const StringaCom = "ebook2cw -w " + VelCW + " -f " + NotaCW + " -T SINE -o /tmp/TestoCW /tmp/testo.txt";
        exec(StringaCom, (error, stdout, stderr) => {
            if (error) {
                return message.channel.send("Errore: " + error.message);
            } if (stderr) {
                return message.channel.send("STDErr: " + stderr);
            }
            console.log(stdout);
            //Riproduzione del file generatao
            play(message.guild, message, LettereOUT);
        });
    } catch (err) {
        // Riporta gli altri errori
        console.log(err);
        message.channel.send(err);
    }
}

function stop(serverQueue, message) {
    // Funzione per bloccare il messaggio in corso
    if (!message.member.voice.channel) {
        // Se l'utente non è in un canale vocale non può bloccare la sequenza
        message.channel.send("Devi essere in un canale vocale per fermare la musica!");
        return
    }

    if (RiproduzioneAttiva) {
        const connection = getVoiceConnection(message.guild.id);
        connection.destroy();
        RiproduzioneAttiva = false;
        message.channel.send("OK! Me ne torno nel mio cloud...");
        staiZitto = true;
    } else {
        // Se ricevo un comando STOP senza musica in esecuzione riporto l'errore
        message.channel.send("Ehi! Non sto facendo nulla!");
    }
    return
}

async function play(guild, message, testo) {
    const serverQueue = queue.get(guild.id);
    primoCiclo = false;
    try {
        const voiceChannel = message.member.voice.channel;
        const voiceConnection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator,
            selfDeaf: false,
        })
        const connection = getVoiceConnection(message.guild.id);
        const player = createAudioPlayer();
        let resource = createAudioResource("/tmp/TestoCW0000.mp3");
        try {
            await entersState(voiceConnection, VoiceConnectionStatus.Ready, 5000);
            console.log("Connected: " + voiceChannel.guild.name);
        } catch (error) {
            message.channel.send(error.content)
            console.log("Voice Connection not ready within 5s.", error);
            return null;
        }
        connection.subscribe(player);
        message.channel.send("Messaggio in arrivo!");
        player.play(resource);
        player.on('stateChange', (oldState, newState) => {
            if (newState.status === 'idle') {
                voiceConnection.destroy();
                console.log("Fine del messaggio CW");
                RiproduzioneAttiva = false;
                message.channel.send("Testo: " + testo.toUpperCase());
            }
        });
    } catch (err) {
        if (err instanceof TypeError && err.message.includes("Cannot read property 'join' of null")) {
            // Gestisci l'errore di mancata connessione alla chat vocale
            console.log("An error occurred: Cannot read property 'join' of null");
            message.channel.send("Devi prima accedere ad una chat vocale!")
            return;
        } else {
            message.channel.send(err.message);
            return;
        }
    }

    // const dispatcher = serverQueue.connection
    //     //Riproduco la stringa convertita in CW
    //     .play('/tmp/TestoCW0000.mp3')
    //     .on("finish", () => {
    //         //return message.channel.send("Fine del messaggio CW");
    //         serverQueue.voiceChannel.leave();

    //         RiproduzioneAttiva = false;
    //         if (staiZitto) {
    //             staiZitto = false;
    //         } else {
    //             if ((!messaggioQ) & (!parole) & (!callsign) & (!parEng)) {
    //                 var strTemp = "";
    //                 //Ricostruisco il messaggio originale togliendo le spaziature modificate
    //                 //eseguo il codice solamente se non si tratta di Qodice Q
    //                 for (var i = 0; i < testo.length; i++) {
    //                     if (testo.charAt(i) !== " ") {
    //                         strTemp += testo.charAt(i);
    //                     }
    //                 }
    //                 testo = "";
    //                 for (var i = 0; i < strTemp.length; i += WordLen) {
    //                     testo += strTemp.substring(i, (i + WordLen)) + " ";
    //                 }
    //             }
    //             message.channel.send("Testo: " + testo.toUpperCase());
    //         }
    //         return
    //     })
    //     .on("error", error => console.error(error));
    // dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
}

function botKill(message) {
    //Uccidi il BOT
    console.log("Processo ucciso su comando del utente");
    message.channel.send("Addio mondo crudele!");

    return process.exit(200);
}

client.login(token);