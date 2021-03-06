function Point(x,y){
	this.x = x;
	this.y = y;
}
function Navaid(id,x,y,airport){
	this.id = id;
	this.location = new Point(x,y);
	this.airport = airport;
}
function Plane(x,y,id){
	this.id = id;
	this.location = new Point(x,y);
	this.worker;
	this.destination;
}

var canvas;
var ctx;
//config object used to set the parameters of the game. This object is passed to the worker thread to initialize it
var config = new Object();
config.grid_x = 900;
config.grid_y = 600;
config.num_planes = 15;
config.num_nodes = 30;
config.range = 600;
config.max_run_time = 10000;
config.max_trips = 10;
config.p_airport = 1;
config.cities = [];
config.alpha = 1;
config.beta = 5;
config.e = 5;
config.Q = 1000;
config.contrail_decay = 0.5;
var worker;
var gamestate;
var shortest_tour = [];

//start the run loop
function init(){
	canvas = document.getElementById('canvas');
	ctx = canvas.getContext("2d");
	(function animloop(){
      requestAnimFrame(animloop, canvas);
      draw_state();
    })();
	if(typeof(worker) != 'undefined') worker.terminate();
	$.get($('#tsp_map').val()+'.txt', function(data){
		shortest_tour = [];
		switch($('#tsp_map').val()){
			case 'berlin52':
				config.p_airport = 1;
				break;
			case 'square':
				config.p_airport = 1;
				break;
			case 'circle':
				config.p_airport = 1;
				break;
			case 'other':
				config.p_airport = 0.8;
				break;
			case 'random':
				config.p_airport = 0.6;
				break;
		}
		
		worker = new Worker("atc.js");
		worker.onerror = function(error) {
			//console.log(error.message);
		};
		var lines=data.split("\n");
		config.cities = [];
		for(var i=0; i<lines.length; i++) {
			var parts = lines[i].split(' ');
			if(parts.length != 3)
				continue;
			var city = new Object();
			city.x = parts[1];
			city.y = parts[2];
			config.cities.push(city);
		}
		
		$('#result').empty();
		$('#status').empty();
		
		worker.onmessage = function(event) {
			handle_worker_message(event.data);
		};
		var message = new Object();
		message.act = "init";
		message.data = config;
		worker.postMessage(JSON.stringify(message));
		start();
	});
}


function handle_worker_message(data){
	var resultObj = JSON.parse(data);
	if(resultObj.act == "debug"){
		$('#result').append(resultObj.data+"<br>");
		return false;
	}
	if(resultObj.act == "update"){
		gamestate = resultObj.data.gamestate;
		if(typeof(resultObj.data.shortest_tour_length) != 'undefined' && resultObj.data.shortest_tour_length != 99999){
			$('#result').html("Best path so far: "+resultObj.data.shortest_tour.join("->")+" with a length of "+resultObj.data.shortest_tour_length);
			shortest_tour = resultObj.data.shortest_tour;
		}
		if(typeof(resultObj.data.end_trip) != 'undefined' && resultObj.data.end_trip && gamestate.tripCount < config.max_trips){
			start();
		}
		return true;
	}
}

function draw_state(){
	if(typeof(gamestate) == 'undefined' || !gamestate.hasChanged){return;}
	gamestate.hasChanged = false;
	ctx.clearRect(0, 0, config.grid_x, config.grid_y);
	ctx.fillStyle = "#000";
	
	for(var i=0;i<gamestate.nodes.length;i++){
		for(var j=0;j<gamestate.nodes.length;j++)
			if(gamestate.contrails[i][j] > 0){
				ctx.lineWidth = Math.min(gamestate.contrails[i][j],5); 
				ctx.beginPath();
				ctx.moveTo(gamestate.nodes[i].location.x/2, gamestate.nodes[i].location.y/2);
				ctx.lineTo(gamestate.nodes[j].location.x/2, gamestate.nodes[j].location.y/2);
				ctx.strokeStyle = "rgba(0,0,255, 0.5)";
				ctx.stroke();
			}
	}
	ctx.beginPath();
	for(var i=0;i<shortest_tour.length-1;i++){
		
		ctx.moveTo(gamestate.nodes[shortest_tour[i]].location.x/2, gamestate.nodes[shortest_tour[i]].location.y/2);
		ctx.lineTo(gamestate.nodes[shortest_tour[i+1]].location.x/2, gamestate.nodes[shortest_tour[i+1]].location.y/2);
	
	}
	ctx.lineWidth = 3;
	ctx.strokeStyle = "rgba(255,255,0, 0.8)";
	ctx.stroke();
	for(var i = 0;i<gamestate.nodes.length;i++){
		ctx.beginPath();
		ctx.arc(gamestate.nodes[i].location.x/2,gamestate.nodes[i].location.y/2,3,0,Math.PI*2,true);
		if(gamestate.nodes[i].airport == 1){
			ctx.fillStyle = "#000";
		}else{
			ctx.fillStyle = "#CCC";
		}
		if(i == 0){
			ctx.fillStyle = "#0F0";
		}
		ctx.fill();
	}
	for(var i=0;i<gamestate.aircraft.length;i++){
		ctx.beginPath();
		ctx.arc(gamestate.aircraft[i].location.x/2,gamestate.aircraft[i].location.y/2,4,0,Math.PI*2,true);
		ctx.fillStyle = "#00F";
		ctx.fill();
	}
	$('#stats').html("Time: <strong>"+ gamestate.runCount + "<\/strong>, trips completed: <strong>" + gamestate.tripCount + "<\/strong>");
}

// shim layer with setTimeout fallback
    window.requestAnimFrame = (function(){
      return  window.requestAnimationFrame       || 
              window.webkitRequestAnimationFrame || 
              window.mozRequestAnimationFrame    || 
              window.oRequestAnimationFrame      || 
              window.msRequestAnimationFrame     || 
              function(/* function */ callback, /* DOMElement */ element){
                window.setTimeout(callback, 1000 / 60);
              };
    })();


//start the simulation
function start(){
	if(typeof(worker) == 'undefined'){ init(); return;}
	var message = new Object();
	message.act = "start";
	worker.postMessage(JSON.stringify(message));
}

//pause the game
function stop(){
	var message = new Object();
	message.act = "pause";
	worker.postMessage(JSON.stringify(message));
}