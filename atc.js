//postMessage('{"act":"debug","data":"message"}');
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
	this.finished = false;
}
/**
This is the worker. It is used to perform all the CPU-intensive
processing, so the GUI will remain responsive.
**/

var config;
var stop_running = true;
var gamestate;
var tock_count = 0;
var shortest_tour_length = 99999;
var shortest_tour = [];
var finished_count = 0;
var end_trip = false;

//this is the function that is called whenever the worker receives a message.
//based on the content of the message (event.data.act), do the appropriate action.
onmessage = function(event) {
	var message = JSON.parse(event.data);
	switch(message.act){
		case 'pause':
			stop_running = true;
			break;
		case 'init':
			config = message.data;
			config.num_airports = 0;
			gamestate = new Object();
			gamestate.nodes = [];
			if(config.cities.length > 0){
				for(var i = 0;i<config.cities.length;i++){
					var rnum = Math.floor(Math.random()+config.p_airport); //30% chance of 0, 70 % chance of 1
					//count how many airports we have
					if(rnum) config.num_airports++;
					var rx = config.cities[i].x;
					var ry = config.cities[i].y;
					gamestate.nodes[i] = new Navaid(i,rx,ry,rnum);
				}
			}else{
				for(var i = 0;i<config.num_nodes;i++){
					var rnum = Math.floor(Math.random()+config.p_airport); //30% chance of 0, 70 % chance of 1
					//count how many airports we have
					if(rnum) config.num_airports++;
					var rx = parseInt(Math.random()*(config.grid_x*2-10))+5;
					var ry = parseInt(Math.random()*(config.grid_y*2-10))+5;
					gamestate.nodes[i] = new Navaid(i,rx,ry,rnum);
				}
			}
			//force start city to be an airport
			if(gamestate.nodes[0].airport == 0){
				gamestate.nodes[0].airport = 1;
				config.num_airports++;
			}
			gamestate.contrails = [];
			for(var i=0;i<=gamestate.nodes.length;i++){
				gamestate.contrails[i] = new Array();
				for(var j=0;j<=gamestate.nodes.length;j++)
					gamestate.contrails[i][j] = 0.0001;
			}
			
			gamestate.contrails_delta = [];
			for(var i=0;i<=gamestate.nodes.length;i++){
				gamestate.contrails_delta[i] = new Array();
				for(var j=0;j<=gamestate.nodes.length;j++)
					gamestate.contrails_delta[i][j] = 0;
			}
			
			gamestate.aircraft = [];
			for(var i = 0;i<config.num_planes;i++){
				gamestate.aircraft[i] = new Plane(gamestate.nodes[0].location.x,gamestate.nodes[0].location.y,i);
				gamestate.aircraft[i].worker = new Worker("plane.js");
				gamestate.aircraft[i].worker.onerror = function(error) {
						postMessage('{"act":"debug","data":"'+error.message+'"}');
					};
				gamestate.aircraft[i].worker.onmessage = function(event) {
					tock(event.data);
				};
				gamestate.aircraft[i].destination = gamestate.nodes[0];
				var message = new Object();
				message.act = "init";
				message.data = new Object();
				message.data.config = config;
				message.data.plane = new Plane(gamestate.aircraft[i].location.x,gamestate.aircraft[i].location.y,gamestate.aircraft[i].id);
				message.data.plane.destination = gamestate.aircraft[i].destination;
				message.data.nodes = gamestate.nodes;
				gamestate.aircraft[i].worker.postMessage(JSON.stringify(message));
			}
			gamestate.runCount = 0;
			gamestate.tripCount = 0;
			gamestate.hasChanged = true;
			var message = new Object();
			message.act = "update";
			message.data = new Object();
			message.data.gamestate = gamestate;
			postMessage(JSON.stringify(message));
			break;
		case 'start':
			if(stop_running == false) return;
			stop_running = false;
			end_trip = false;
			tock_count = gamestate.aircraft.length;
			run();
			break;
	}
}

function run(){
	if(tock_count <= 0){
		gamestate.runCount++;
		gamestate.hasChanged = true;
		
		if(finished_count >= gamestate.aircraft.length || gamestate.runCount > config.max_run_time){
			for(var i = 0;i<gamestate.aircraft.length;i++){
				if(gamestate.aircraft[i].finished){
					gamestate.aircraft[i].finished = false;
				}
				else{
					gamestate.aircraft[i].worker.postMessage('{"act":"reset","data":{"x":'+gamestate.nodes[0].location.x+',"y":'+gamestate.nodes[0].location.y+'}}');
				}
			}
			finished_count = 0;
			
			//Update 'Pheromone'
			for(var i=0;i<=gamestate.nodes.length;i++){
				for(var j=0;j<=gamestate.nodes.length;j++)
					gamestate.contrails[i][j] = (1-config.contrail_decay)*gamestate.contrails[i][j] + gamestate.contrails_delta[i][j];
			}
			for(var i = 0;i<shortest_tour.length-1;i++){
				gamestate.contrails[shortest_tour[i]][shortest_tour[i+1]]+=config.e*config.Q/shortest_tour_length;
			}
			for(var i=0;i<=gamestate.nodes.length;i++){
				for(var j=0;j<=gamestate.nodes.length;j++)
					gamestate.contrails_delta[i][j] = 0;
			}
			gamestate.runCount = 0;
			gamestate.tripCount++;
			stop_running = true;
			end_trip = true;
		}
		
		
		//only update the GUI every 4th run for performance
		if(gamestate.runCount%20 == 0){
			var message = new Object();
			message.act = "update";
			message.data = new Object();
			message.data.gamestate = gamestate;
			message.data.shortest_tour = shortest_tour;
			message.data.shortest_tour_length = shortest_tour_length;
			message.data.end_trip = end_trip;
			postMessage(JSON.stringify(message));
		}
		tock_count = gamestate.aircraft.length;
		if(stop_running){
			return;
		}
	}
	tock_count--;
	if(gamestate.aircraft[tock_count].finished){
		run();
		return;
	}
	var message = new Object();
	message.act = "tick";
	message.data = new Object();
	message.data.arrival = arrival(gamestate.aircraft[tock_count]);
	//If navaid_here, then get a list of navaids within reachable distance
	if(message.data.arrival){
		message.data.potential_destinations = get_potential_destinations(gamestate.aircraft[tock_count].destination.id);
	}
	gamestate.aircraft[tock_count].worker.postMessage(JSON.stringify(message));
}

function tock(data){
	var message = JSON.parse(data);
	if(message.act != 'tock'){postMessage(data); return;}
	
	gamestate.aircraft[message.data.plane.id].location = message.data.plane.location;
	gamestate.aircraft[message.data.plane.id].destination = message.data.plane.destination;
	
	
	if(typeof(message.data.step.tour_complete) != 'undefined' && message.data.step.tour_complete){
		if(message.data.tour_length < shortest_tour_length){
			shortest_tour_length = message.data.tour_length;
			shortest_tour = message.data.tour;
		}
		gamestate.aircraft[message.data.plane.id].finished = true;
		finished_count++;
		
		for(var i = 0;i<message.data.tour.length-1;i++){
			gamestate.contrails_delta[message.data.tour[i]][message.data.tour[i+1]]+=config.Q/message.data.tour_length;
		}
		
	}
	
	if(!stop_running){
		run();
	}
}

function arrival(aircraft){
	return (Math.sqrt((aircraft.location.x-gamestate.nodes[aircraft.destination.id].location.x)*(aircraft.location.x-gamestate.nodes[aircraft.destination.id].location.x) + (aircraft.location.y-gamestate.nodes[aircraft.destination.id].location.y)*(aircraft.location.y-gamestate.nodes[aircraft.destination.id].location.y)) <= 2);
}

function get_potential_destinations(from){
	var result = [];
	for(var to = 0;to<gamestate.nodes.length;to++){
		if(to == from) continue;
		var dist = Math.sqrt((gamestate.nodes[from].location.x-gamestate.nodes[to].location.x)*(gamestate.nodes[from].location.x-gamestate.nodes[to].location.x) + (gamestate.nodes[from].location.y-gamestate.nodes[to].location.y)*(gamestate.nodes[from].location.y-gamestate.nodes[to].location.y));
		if(dist <= config.range){
			result[result.length] = {'navaid':gamestate.nodes[to], 'contrail':gamestate.contrails[from][to], 'distance':dist};
		}
	}
	return result;
}
