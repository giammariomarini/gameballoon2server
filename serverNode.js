var express = require('express'); // Get the module
var app = express(); // Create express by calling the prototype in var express

var http = require('http').Server(app);
								//come sopra le scritte equivalenti sono:
								//var pippo=require('http')
								//var http=pippo.Server(app)
var io = require('socket.io')(http);
								//come sopra
const axios = require('axios');
//ricorda di modificare la url dell'hosting quano pubblichi su sito esterno
const urlWebServer='http://127.0.0.1:80/gameb/'

var debug=true; // true o false per vedere l'eco dei messaggi del server

//le righe che seguono mi permettono di direa al server dove sono le risorse statiche (immagini, css, javascript ecc...)
//quelle alle quali nel codice html/javascript faccio riferimento con il percorso relativo o assoluto
app.use(express.static('./client/img'));
app.use(express.static('./client'));

var port = process.env.PORT || 3000;

var FPS=60;
var maxEnemy=25;
var nFrameForNextNewEnemy=40;
var newEnemyEvery=nFrameForNextNewEnemy;
var dimGame=3000
var game;
var wCanvas=500;//sono le stesse dimensione della canvas nel client
var hCanvas=512;
var updateClientEvery=3;
var nLoopToUpdateClient=0;
//======================================================================
//oggetto Game che contiene l'insieme del gioco
//======================================================================
var Game = function(json){
	this.enemies=[];  //elenco dei nemici in gioco
	this.players=[]; //elenco dei players in gioco
	this.action=[]; //elenco delle posizioni trasmesse dai player al server prime dell'ultimo update
	this.newEnemyEvery=nFrameForNextNewEnemy;
	this.width = dimGame;
	this.height= dimGame;
	this.debugCollision=0;
	this.init(json);
	}
//======================================================================
Game.prototype.init = function(json){
	for(var i in json){
		this[i] = json[i];
	}
}
//======================================================================
Game.prototype.start = function(){
	this.loop();
}
//======================================================================
Game.prototype.loop=function()
{
	nLoopToUpdateClient++;
	if(nLoopToUpdateClient>updateClientEvery)
	{
	//i tre momenti fondamentali del gioco
	//================================================
		this.update();
		serializePlayers=JSON.stringify(game.players);
		serializeEnemies=JSON.stringify(game.enemies);
		serializeActions=JSON.stringify(game.action);
		//COMUNICA AI CLIENT
		io.emit('updateClient',{p:serializePlayers,e:serializeEnemies,a:serializeActions});
	this.controlla();
	nLoopToUpdateClient=0;
	}
	//================================================
	
	//in javascript questa che segue permette di ripetere questa funzione ogni 1000/FPS secondi
	//cioè realizza il ciclo entro chi inserire le azioni di gioco finchè il giocatore è ancora in vita
	var self = this;
	setTimeout(function(){
			self.loop();
		}, 1000/FPS);
}
//======================================================================
Game.prototype.update=function(){
	//il game aggiorna se stesso, in questo caso generando eventualmente nuovi nemici
	//quindi procede all'aggiornamento di tutte le componenti in gioco
	newEnemyEvery--;
			if(newEnemyEvery<=0&&this.enemies.length<maxEnemy) //genero nuovi nemici solo se non sono già arrivato al massimo di nemici previsti
			{
				//==========================================================
				// generazione nuovo nemico
				// la poszione sarà casuale in orizzontale, mentre il nemico nascerà comununque sempre da un bordo superiore o inferiore
				// la dimensione sarà leggermente maggiore o miniore della dimensione del player in gioco più piccolo o più grande (sempre casuale)
				//==========================================================
				
				newEnemyEvery=nFrameForNextNewEnemy;
				//parte sempre dal bordo in alto o in basso
				//la x è casuale in base alla lunghezza del campo di gioco
				px=Math.floor(Math.random()*dimGame);//posizione casuale della x
				//determino la dimensione della media dei player in gioco
				var widthEnemy=30; //valore da usare solo se non ci sono player (non dovrebbe succedere perchè in quel caso il gioco è fermo)
				if(this.players.length>0)
				{	
					var maxWidth=this.players[0].width;
					var minWidth=this.players[0].width;
					for(var i=1;i<this.players.length;i++)
					{
					if(this.players[i].width>maxWidth)
						maxWidth=this.players[i].width;
					if(this.players[i].width<minWidth)
						maxWidth=this.players[i].width;
					}
					//determino casualmente se prendere il massimo o il minimo (con possibilità maggiori per il minimo)
					widthEnemy=minWidth;
					if(Math.random()>=0.7)widthEnemy=maxWidth;
				}
				//determino se aumentare o diminuire la dimensione rispetto al player (favorisco il diminuire)
				var piuMeno=1
				if(Math.random()>=0.4)piuMeno=-1
				//determino di quanto aumentare o diminuire fino ad un massimo 10% della width del player
				quanto=Math.random()*(widthEnemy*0.1);
				//determino la dimensione della sfera nemica
				wperc=widthEnemy+(quanto*piuMeno);
				//determino la posizione py (se in alto o in basso)
				var py=0;
				if(Math.random()>=0.5)py=dimGame-widthEnemy;
				//genero il nuovo nemico
				e=new Enemy({x:px,y:py,width:wperc}); 
				this.enemies.push(e);
				//==========================================================
				// fine generazione nuovo nemico
				//==========================================================
				
			}
				//===========================================================
				// determinazione della direzione da seguire per i nemici
				//==========================================================
		for(var i=0;i<this.enemies.length;i++)
			{
				p=-1;
				if(this.players.length>1)
					p=Math.floor(Math.random()*this.players.length);//posizione casuale nel vettore players
				else if(this.players.length==1)p=0;
				if(p!=-1)
				{
				xseguire=this.players[p].x;
				yseguire=this.players[p].y;
				
				this.enemies[i].update(xseguire,yseguire);
			
				}
			}
				//===========================================================
				// fine determinazione della direzione da seguire per i nemici
				//==========================================================
			 //=============================================================
			//tolgo dal vettore i nemici morti
			//==============================================================
			for(var i=0;i<this.enemies.length;i++)
			{
			if(this.enemies[i].alive==false)
				{
					this.enemies.splice(i,1);//tolgo dal vettore
					i--;
				}
			}
	 //=========================================================		
	//aggiorno i player in base al vettore action 
	//=========================================================
	for(var i=0;i<this.action.length;i++)
		{for(var j=0;j<this.players.length;j++)
			{
				if(this.action[i].id==this.players[j].id)
				{
					this.players[j].x=this.action[i].x;
					this.players[j].y=this.action[i].y;
					
					
					this.players[j].target.x0=this.action[i].x;
					this.players[j].target.y0=this.action[i].y;
					
				}
			}
		
		}
	//==================================================================
	// controllo se ci sono i ancora players, altrimenti cancello i numici
	// tanto non mi servono
	// il gioco, una volta iniziato con almeno un player, non lo fermo più
	// a meno di fermare il server
	//==================================================================
	
	if(this.players.length<=0)
	{
		if(this.enemies.length>0)
		{
			tot=this.enemies.length;
			if(tot>0)this.enemies.splice(0,tot);//cancello il vettore dei nemici
		}
	}
}
//======================================================================
Game.prototype.controlla=function(){
	if(this.debugCollision==0)
	{
	//=================================================	
	//collisione tra palyers e nemici
	//=================================================
	for(var j=0;j<this.enemies.length;j++)
		{
			for(var k=0;k<this.players.length;k++)
			{	
				if(this.players[k].alive&&!this.players[k].target.isCollision(this.players[k].home.target)) //se è vivo ed è furoi casa devo procedere
				{	
				if(this.players[k].alive&&this.enemies[j].alive)
				{
					if(this.players[k].target.isCollision(this.enemies[j].target))
					{
					//se il nemico è più piccolo, mi da punteggio, aumenta la dimesione del player
					//ma diminiusci la mia velocita
						if(this.players[k].width>=this.enemies[j].width)
						{
							this.players[k].score++;
							if(this.players[k].width<this.players[k].wmax)
								{
								this.players[k].width++;
								if(this.players[k].velocita>1)this.players[k].velocita=this.players[k].velocita-0.1
								this.players[k].target.init({raggio:this.players[k].width/2});
								}
						}
					else{
					this.players[k].numOfLive--;
					}
					//in ogni caso il nemico muore
					this.enemies[j].alive=false;
					if(this.players[k].numOfLive<=0)this.players[k].alive=false;
					}
				}
			}
			}
		}
	}
	//collisione tra nemico e nemico
	//se due nemici si sopvrappongono il più piccolo soccombe
	for(var j=0;j<this.enemies.length-1;j++)
	{
		for(var k=j+1;k<this.enemies.length;k++)
		{
			if(this.enemies[j].alive&&this.enemies[k].alive)
			{
				if(this.enemies[j].target.isCollision(this.enemies[k].target))
				{
					if(this.enemies[j].width>=this.enemies[k].width)
					this.enemies[k].alive=false
					else
					this.enemies[j].alive=false	
				}
			}
		}
		
	}
	
	//collisione tra player e player
	//se due player si sopvrappongono il più piccolo soccombe
	for(var j=0;j<this.players.length-1;j++)
	{
		for(var k=j+1;k<this.players.length;k++)
		{	//se entrambi i due player sono fuori casa posso procedere
			if(this.players[j].alive&&this.players[k].alive&&(!this.players[j].target.isCollision(this.players[j].home.target)&&!this.players[k].target.isCollision(this.players[k].home.target)))
			{
				if(this.players[j].alive&&this.players[k].alive)
				{
					if(this.players[j].target.isCollision(this.players[k].target))
					{
						if(this.players[j].width>=this.players[k].width)
							this.players[k].alive=false;
						else
							this.players[j].alive=false;	
					}
				}
			}
		}
	}
	//tolgo i players morti (li devo togliere uno alla volta altrimenti l'indice del ciclo si incasina perchè la lunghezza del vettore cambia di volta in volta)
	daCancellare=0;
	while(daCancellare==0)
	{
		trovato=0;
		for(var i=0;i<this.players.length;i++)
		{
			if(this.players[i].alive==false)
			{		
				idDaComunicare=this.players[i].id;
				diePlayer(idDaComunicare); //chiamo la funzione che cancella (e accorcia il vettore)
				trovato=1;
				io.emit('diePlayerForIt',idDaComunicare);//comunico la morte anche al player stesso, questo perchè la mort l'ha certtificata il server
			}	
		}
		if(trovato==0) daCancellare=1; //non ho più elementi da cancellare
	}
}
//=====================================================================================
//=========================================
// player
//=========================================
var Player=function(json)
{
	this.name=null;
	this.id=0;//da assegnare in fase di istanziazione nel server
	//valori di base
	this.x = 80;
	this.y = 250;
	this.score=0; //punteggio del player
	this.width = 45; //da definire in fase di istanziazione, non c'è height perchè quadrato
	this.wmax=0;//da definire in fase di istanziazione
	this.velocita;
	this.numOfLive=5;
	this.alive = true;
	//eventuali valori aggiornati con la new Player
	this.init(json);
	//creazione del target
	this.target=new Target({x0:this.x,y0:this.y,raggio:this.width/2});
}
//======================================================================
Player.prototype.init = function(json){
	for(var i in json){
		this[i] = json[i];
	}
}
//=========================================
// Enemy
//=========================================
var Enemy=function(json){
	//valori di base
	this.x = 80;
	this.y = 0;
	this.width = 40;
	this.velocita=2;
	this.alive = true;
	//eventuali valori aggiornati con la new Player
	this.init(json);
	//creazione del target
	this.target=new Target({x0:this.x,y0:this.y,raggio:this.width/2});
}
//======================================================================
Enemy.prototype.init = function(json){
	for(var i in json){
		this[i] = json[i];
	}
}
//=======================================================================
Enemy.prototype.update=function(xseguire, yseguire){
	
	if(this.y<yseguire)
				this.y=this.y+this.velocita;
			else 
				this.y=this.y-this.velocita;
	if(this.x<xseguire)
				this.x=this.x+this.velocita;
			else
				this.x=this.x-this.velocita;
	//il nemico muore se va fuori schermo
	if(this.x<0||this.x-this.width>dimGame||this.y<0||this.y-this.width>dimGame)this.alive=false; //fuori schermo

		//aggiorno il bersaglio
	this.target.init({x0:this.x,y0:this.y});
}
//=======================================================================
//=========================================
// Home
//=========================================
var Home=function(json){
	//valori di base
	this.x ;
	this.y ;
	this.width = 40;
	//eventuali valori aggiornati con la new Player
	this.init(json);
	//creazione del target
	this.target=new Target({x0:this.x,y0:this.y,raggio:this.width/2});
}
//======================================================================
Home.prototype.init = function(json){
	for(var i in json){
		this[i] = json[i];
	}
}

//=======================================================================
// Target
//=======================================================================
//target è una classe che rappresenta il bersaglio di riferimento per
//ogni oggetto del gioco per calcolare le collisoni
//in questo esempio target è una circonferenza
var Target=function(json){
	this.x0=0;
	this.y0=0;
	this.raggio=0;
	this.init(json);
}
//==========================================================================
Target.prototype.init = function(json){
	for(var i in json){
		this[i] = json[i];
	}
}
//==========================================================================
Target.prototype.isCollision=function(targetOther)
{ 	
	var r=false;
	//se la distanza tra i centri è minore della somma dei raggi c'e' contatto
	d=Math.sqrt(Math.pow(this.x0-targetOther.x0,2)+Math.pow(this.y0-targetOther.y0,2));
	if(d<(this.raggio+targetOther.raggio)) r=true
	return r;
}

//===================================================================
// Gestione eventi del socket
//===================================================================

app.get('/', async function(req, res){
	//res.sendFile(__dirname + '/../client/index.html');
	try {
    const externalServerUrl = urlWebServer; // url web server dove pubblicata la 
    const response = await axios.get(externalServerUrl);
    const data = response.data;
    res.send(data);
  } catch (error) {
    res.status(500).send('Errore durante la richiesta al server esterno.');
  }
});

app.get('/get-png', async (req, res) => {
  try {
	const namepng = req.query.namepng;
    const remotePngUrl = urlWebServer+'/img/'+namepng;
	//console.log(remoteCssUrl);
    const response = await axios.get(remotePngUrl, {
      responseType: 'arraybuffer', // Ricevi i dati come binary
    });
    const remotePng = response.data;
	//console.log(remotePng);
    res.setHeader('Content-Type', 'image/png'); // Imposta il tipo MIME 
    res.send(remotePng);
  } catch (error) {
    res.status(500).send('Errore durante il recupero del file PNG.');
  }
});

app.get('/get-js', async (req, res) => {
  try {
	const namejs = req.query.namejs;
    const remoteJsUrl = urlWebServer+namejs;
	//console.log(remoteJsUrl);
    const response = await axios.get(remoteJsUrl, {
      responseType: 'text', // può essere omesso, default Ricevi i dati come text
    });
    const remoteJs = response.data;
	console.log(remoteJs);
    res.setHeader('Content-Type', 'application/javascript'); // Imposta il tipo MIME 
    res.send(remoteJs);
  } catch (error) {
    res.status(500).send('Errore durante il recupero del file PNG.');
  }
});

app.get('/get-css', async (req, res) => {
  try {
	const name = req.query.name;
    const remoteCssUrl = urlWebServer+name;
	//console.log(remoteCssUrl);
    const response = await axios.get(remoteCssUrl);	
    const remoteCss = response.data;
    res.header('Content-Type', 'text/css'); // Imposta il tipo MIME a 'text/css'
    res.send(remoteCss);
  } catch (error) {
    res.status(500).send('Errore durante il recupero del file CSS.');
  }
});

io.on('connection', function(socket){
	if(debug)console.log('a user connect');
	//Il gioco inizia quando all'avvio del server
	if (game === undefined || game === null) {
     game=new Game();
	game.start();

	}
	
	
	socket.on('newPlayer',function(msgJson){
		
		var p=new Player(msgJson); //creo l'oggetto player
		var h=new Home({x:p.x,y:p.y,width:p.width});//creo l'oggetto home del player
		p.home=h;
		game.players.push(p); //lo aggiungo a quelli in gioco
		if(debug)console.log('newPlayer:'+msgJson.id);
		//comunico in broadcast l'elenco di tutti i player in gioco
		serializePlayers=JSON.stringify(game.players);
		io.emit('newPlayerForOther',{p:serializePlayers});
	});
	
	socket.on('diePlayer',function(idp){
		diePlayer(idp);});
	
	socket.on('updatePlayer',function(msgJson){
		//aggiorno il vettore dei movimenti
		var idDaCercare=msgJson.id;
		//cerco se ho già un aggiornamento, lo tolgo, in modo da lasciare solo 1 aggiornamento per player
	
		for(var i=0;i<game.action.length;i++)
		{
			if(game.action[i].id==idDaCercare)
			{
					
					game.action.splice(i,1);//tolgo dal vettore
					i--;
			}
		}
			//aggiungo l'ultimo aggiornamento

		game.action.push(msgJson);
		
	});
	
	//ho fatto il refresh della pagina prima di terminare il gioco
	socket.on('disconnect', function(){
			if(debug)console.log('user disconnected');
			diePlayer(socket.id);
			});
});

function diePlayer(idp)
{
	//provvede alla gestione della morte di un Player
	//riceve in ingresso id del player morto
	//è usata sia in fase di gioco quando un player termina le suoe vite
	//sia in caso di disconnessione (refresh della pagina)
	
	trovato=0;
		for(var i=0;i<game.players.length&&trovato==0;i++)
			{
				if(game.players[i].id==idp)
				{
					game.players.splice(i,1);//tolgo dal vettore
					i--;
					trovato=1
				}
			}
		io.emit('diePlayerForOther',idp);
}


http.listen(port, function(){
	// use port 3000 unless there exists a preconfigured port
	console.log('listening on '+port);
});