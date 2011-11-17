//import scripts:
//json2.js is an open source JSON parser, available at http://www.json.org/js.html
//json2.js is used to convert objects to string when passing to/from the worker
importScripts('json2.js');
//postMessage('{"act":"debug","data":"message"}');
function Point(x,y){
	this.x = x;
	this.y = y;
}
function Navaid(x,y,airport){
	this.id = id;
	this.location = new Point(x,y);
	this.airport = airport;
}
function Plane(x,y,id){
	this.id = id;
	this.location = new Point(x,y);
	this.destination;
}
/**
This is the worker. It is used to perform all the CPU-intensive
processing, so the GUI will remain responsive.
**/
var config;
var this_plane;
var environment;
var step_data;
var visited_airports;
var tour_length;
var tour_path;
var last_visited_id;

//this is the function that is called whenever the worker receives a message.
//based on the content of the message (event.data.act), do the appropriate action.
onmessage = function(event) {
	var message = JSON.parse(event.data);
	switch(message.act){
		case 'init':
			config = message.data.config;
			this_plane = message.data.plane;
			visited_airports = [0];
			visited_navaids = []
			tour_path = [0];
			tour_length = 0;
			last_visited_id = 0;
			break;
		case 'reset':
			this_plane.location.x = message.data.x;
			this_plane.location.y = message.data.y;
			visited_airports = [0];
			visited_navaids = []
			tour_path = [0];
			tour_length = 0;
			last_visited_id = 0;
			break;
		case 'tick':
			environment = message.data;
			step();
			break;
	}
}

function step(){
	step_data = new Object();
	
	if(environment.arrival){
		if(this_plane.destination.id == 0 && visited_airports.length > config.num_airports-1){
			step_data.tour_complete = true;
			var message = new Object();
			message.act = "tock";
			message.data = new Object();
			message.data.plane = this_plane;
			message.data.step = step_data;
			message.data.tour = tour_path;
			message.data.tour_length = tour_length;
			postMessage(JSON.stringify(message));
			
			visited_airports = [0];
			visited_navaids = []
			tour_path = [0];
			tour_length = 0;
			last_visited_id = 0;
			return;
		}
		
		step_data.new_destination = new Object();
		step_data.new_destination.oldid = this_plane.destination.id;
		
		valid_destinations = [];
		navaids = [];
		for(var i = 0;i<environment.potential_destinations.length;i++){
			if(environment.potential_destinations[i].navaid.airport){
				if(environment.potential_destinations[i].navaid.id == 0 && visited_airports.length > config.num_airports-1){
					valid_destinations.push(environment.potential_destinations[i]);
				}
				if(visited_airports.indexOf(environment.potential_destinations[i].navaid.id) < 0){
					valid_destinations.push(environment.potential_destinations[i]);
				}
			}else{
				navaids.push(environment.potential_destinations[i]);
				if(visited_navaids.indexOf(environment.potential_destinations[i].navaid.id) < 0){
					valid_destinations.push(environment.potential_destinations[i]);
				}
			}
			
			
		}
		
		//no valid destinations, need to revisit a node
		if(valid_destinations.length == 0){
			if(navaids.length == 0)
				valid_destinations = environment.potential_destinations;
			else
				valid_destinations = navaids;
		}
		
		for(var i = 0;i<valid_destinations.length;i++){
			if(valid_destinations[i].navaid.id == last_visited_id){
				valid_destinations.splice(i,1);
				break;
			}
		}
		
		var p_sum = 0;
		for(var i = 0;i<valid_destinations.length;i++){
			valid_destinations[i].p = Math.pow(valid_destinations[i].contrail,config.alpha)*Math.pow(1/valid_destinations[i].distance,config.beta);
			p_sum += valid_destinations[i].p;
		}
		var new_p_sum = 0;
		for(var i = 0;i<valid_destinations.length;i++){
			valid_destinations[i].p = valid_destinations[i].p/p_sum;
			new_p_sum += valid_destinations[i].p;
		}
		
		var next = 0;
		var rnum = Math.random()*new_p_sum;
		for(var i = 0;i<valid_destinations.length;i++){
			rnum=rnum-valid_destinations[i].p;
			if(rnum <= 0){
				next = i;
				break;
			}
		}
		
		if(valid_destinations.length > 0){
			last_visited_id = this_plane.destination.id;
			this_plane.destination = valid_destinations[next].navaid;
			tour_length += valid_destinations[next].distance;
			step_data.new_destination.newid = this_plane.destination.id;
			if(this_plane.destination.airport){
				if(visited_airports.indexOf(this_plane.destination.id) < 0){
					visited_airports.push(this_plane.destination.id);
				}
			}else{
				if(visited_navaids.indexOf(this_plane.destination.id) < 0){
					visited_navaids.push(this_plane.destination.id);
				}
			}
			tour_path.push(this_plane.destination.id);
		}
	}
	
	
	move_to_dest();
	
	
	var message = new Object();
	message.act = "tock";
	message.data = new Object();
	message.data.plane = this_plane;
	message.data.step = step_data;
	postMessage(JSON.stringify(message));
}



function move_to_dest(){
	dy = this_plane.location.y - this_plane.destination.location.y;
	dx = this_plane.location.x - this_plane.destination.location.x;
	a = Math.atan2(dy, dx);
	this_plane.location.x -= 2*Math.cos(a);
	this_plane.location.y -= 2*Math.sin(a);
}