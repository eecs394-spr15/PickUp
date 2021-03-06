//Functions
function makeid()
{
	var text = "";
	var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

	for( var i=0; i < 5; i++ )
		text += possible.charAt(Math.floor(Math.random() * possible.length));

	return text;
}


//Cloud Code
// Use Parse.Cloud.define to define as many cloud functions as you want.
// For example:
Parse.Cloud.define("hello", function(request, response) {
	response.success("Hello world!");
});

Parse.Cloud.define("get_more", function(request, response)
{
    //gets list of players
    var query = new Parse.Query("Players");
    query.equalTo("GameID", request.params.GameID);
    query.select("PlayerID");

    var players;

    query.find({
    	success: function(results)
    	{
    		players = results;
    	}

    });

    var game = new Parse.Query("Current_Games");
    game.equalTo("GameID", request.params.GameID);
    var game_info; //used to store game data
    var location_info; //used to store location data

    game.find().then(function(results)
    {
        game_info = results;
        //console.log(results);
        var location = new Parse.Query("Location");
        location.equalTo("Location_Name", game_info[0].get('Location_Name'));
        return location.find();
    }).then(function(results){
        location_info = results;
        response.success([game_info, players, location_info]);
    }, function(error){
        response.error("lookup failed");
    })
});

Parse.Cloud.define("get_games", function(request, response)
{
	var today;
	if(request.params.Start_Time == null || request.params.Start_Time == "")
	{
		today = new Date();
	}
	else
	{
		today = request.params.Start_Time;
	}
	console.log(today);
	var query = new Parse.Query("Current_Games");
	query.greaterThan("Start_Time", today);
	query.select("GameID", "Location_Name", "Sport", "Num_Of_Players", "Max_Num_Of_Players", "Start_Time", "End_Time");
	query.ascending("Start_Time");
    query.limit(15);//increase to usable size
    query.find({
    	success: function(results) {
    		response.success(results);
    	},
    	error: function() {
    		response.error("Game lookup failed");
    	}
    });
});

Parse.Cloud.define("join_game", function(request, response)
{
    //add name to list of players

    var Players = Parse.Object.extend("Players");
    var add_to_list = new Players();
    //gets data from phone request
    var pid = request.params.PlayerID;
    add_to_list.set("PlayerID", pid.substring(0, pid.search("@")));
    add_to_list.set("GameID", request.params.GameID);
    //Save data to Players table
    add_to_list.save(null,
    {
    	success: function(add_to_list)
    	{
    		response.success("Player added");
    	},
    	error: function(add_to_list, error)
    	{
    		response.error("Player add failed");
    	}
    });


    //increment number in current_games table
    var Current_Games = Parse.Object.extend("Current_Games");
    var add_to_num = new Parse.Query(Current_Games);
    add_to_num.equalTo("GameID", request.params.GameID);

    add_to_num.find({
    	success: function(results) {
    		var game = results[0];
    		var current_player_number = game.get('Num_Of_Players');
    		game.set("Num_Of_Players", current_player_number + 1);
    		game.save(null,
    		{
    			success: function(game)
    			{
    				response.success("Current_Games updated");
    			},
    			error:function(game, error)
    			{
    				response.error("Current_Games update failed");
    			}
    		});
    	},
    	error: function() 
    	{
    		response.error("Game not found");
    	}
    });
});

Parse.Cloud.define("leave_game", function(request, response)
{
	var Players = Parse.Object.extend("Players");
	var add_to_list = new Parse.Query(Players);
    //gets data from phone request
    add_to_list.equalTo("PlayerID", request.params.PlayerID);
    add_to_list.equalTo("GameID", request.params.GameID);
    //Save data to Players table
    add_to_list.find(
    {
    	success: function(results)
    	{
    		var person = results[0];
    		person.destroy(
    		{
    			success: function(person)
    			{
    				response.success("Player dropped");
    			}
                /*
                Including this error check was giving an error for some reason. Look into later. - SW
                error: function(person, error)
                {
                    response.error("Player drop failed");
                }
                */
            })
    	},
    	error: function()
    	{
    		response.error("Player drop failed");
    	}
    });


    //decrement number in current_games table
    var Current_Games = Parse.Object.extend("Current_Games");
    var add_to_num = new Parse.Query(Current_Games);
    add_to_num.equalTo("GameID", request.params.GameID);

    add_to_num.find({
    	success: function(results) {
    		var game = results[0];
    		var current_player_number = game.get('Num_Of_Players');
    		game.set("Num_Of_Players", current_player_number - 1);
    		game.save(null,
    		{
    			success: function(game)
    			{
    				response.success("Current_Games updated");
    			},
    			error:function(game, error)
    			{
    				response.error("Current_Games update failed");
    			}
    		});
    	},
    	error: function() 
    	{
    		response.error("Game not found");
    	}
    });
});

Parse.Cloud.define("create_game", function(request, response)
{
	var Current_Games = Parse.Object.extend("Current_Games");
	var add_to_list = new Current_Games();
    //gets data from phone request
    var newid;
    var oldid;

    Parse.Cloud.run('send_invites', {"PlayerID":request.params.PlayerID, "GameID":request.params.GameID, "InviteList":request.params.InviteList})


    //generates a new GameID and checks it against any ID in the table
    do
    {
    	newid = makeid();
    	console.log(newid);
    	var check_games = new Parse.Query("Current_Games");
    	check_games.equalTo("GameID", newid);
    	check_games.find({
    		success: function(results)
    		{
            	//console.log(oldid);
            	oldid = results;
            }
        })
    }
    while(oldid !=null);

    //Setting variables
    add_to_list.set('GameID', newid);
    add_to_list.set("Location_Name", request.params.Location_Name);
    add_to_list.set("Sport", request.params.Sport);
    add_to_list.set("Max_Num_Of_Players", request.params.Max_Num_Of_Players);
    //gets new date string
    //format of incoming data = 30/04/2015 21:51:11
    var s = request.params.Start_Time;
    var monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    var month = monthNames[Number(s.slice(3,5)) - 1] + " ";
    var date = s.slice(0, 2) + ", ";
    var year = s.slice(6, 10) + " ";
    var time = s.slice(11, 19);
    var date_string = month + date + year + time;
    var new_date = new Date(date_string);
    var d = new_date;//for convenience in creating end_time
    var end_time = request.params.Duration.split(" ");
    var Duration = Number(end_time[0]);
    var end_date = new Date(d.getTime() + 1000 * 60 * Duration);

    add_to_list.set("Start_Time", new_date);
    add_to_list.set("End_Time", end_date);
    add_to_list.set("Notes", request.params.Notes);
    add_to_list.set("Creator", request.params.PlayerID);
    add_to_list.set("Num_Of_Players", 0);
    //Save data to Create Games table
    add_to_list.save(null,
    {
    	success: function(add_to_list)
    	{
    		response.success("Game added");
    	},
    	error: function(add_to_list, error)
    	{
    		response.error("Game add failed");
    	}
    });
    console.log("after games_added");
    //Add to players list
    Parse.Cloud.run('join_game', {"PlayerID":request.params.PlayerID, "GameID":newid})
});


Parse.Cloud.define("get_location", function(request, response)
{
	var query = new Parse.Query("Location");
	query.select("Location_Name");
	query.find({
		success: function(results) {
			response.success(results);
		},
		error: function() {
			response.error("Location lookup failed");
		}
	});
});

Parse.Cloud.define("get_sports", function(request, response)
{
	var query = new Parse.Query("Sports");
	query.equalTo("Location_Name", request.params.Location_Name);
	query.find({
		success: function(results) {
			response.success(results);
		},
		error: function() {
			response.error("Sports lookup failed");
		}
	});
});

Parse.Cloud.define("cancel_game", function(request, response)
{
    //drops game from create_game talbe
    var query = new Parse.Query("Current_Games");
    query.equalTo("GameID", request.params.GameID);
    query.equalTo("Creator", request.params.PlayerID);
    query.find({
    	success: function(results) {
    		var game = results[0];
    		game.destroy(
    		{
    			success: function(game)
    			{
    				response.success("Game dropped");
    			}
                /*
                Including this error check was giving an error for some reason. Look into later. - SW
                error: function(person, error)
                {
                    response.error("Game drop failed");
                }
                */
            })

    	},
    	error: function() {
    		response.error("Game cancel failed");
    	}
    });
    //drop players from Players table
    var players = new Parse.Query("Players");
    players.equalTo("GameID", request.params.GameID);
    players.find({
    	success: function(results){
    		var player;
    		for(i = 0; i < results.length; i++)
    		{
    			player = results[i];
    			player.destroy(
    			{

    			})
    		}
    	},
    	error: function()
    	{
    		response.error("Player drop failed");
    	}
    });
});


//Friends list
Parse.Cloud.define("get_friends", function(request, response)
{
    var query = new Parse.Query("Friends_List");
    query.equalTo("PlayerID", request.params.PlayerID);
    query.find({
        success: function(results) {
            response.success(results);
        },
        error: function() {
            response.error("Friend lookup failed");
        }
    });
});



Parse.Cloud.define("add_friend", function(request, response)
{
    //add name to list of Friends

    var friend = Parse.Object.extend("Friends_List");
    var add_to_list = new friend();
    //gets data from phone request
    add_to_list.set("PlayerID", request.params.PlayerID);
    add_to_list.set("FriendID", request.params.FriendID);
    //Save data to Friends list table table
    add_to_list.save(null,
    {
        success: function(add_to_list)
        {
            response.success("Friend added");
        },
        error: function(add_to_list, error)
        {
            response.error("Friend add failed");
        }
    });
});

Parse.Cloud.define("remove_friend", function(request, response)
{
    var friend = Parse.Object.extend("Friends_List");
    var add_to_list = new Parse.Query(friend);
    //gets data from phone request
    add_to_list.equalTo("PlayerID", request.params.PlayerID);
    add_to_list.equalTo("FriendID", request.params.FriendID);
    //Save data to Players table
    add_to_list.find(
    {
        success: function(results)
        {
            var person = results[0];
            person.destroy(
            {
                success: function(person)
                {
                    response.success("Friend dropped");
                },
                error: function(person, error)
                {
                    response.error("Friend drop failed");
                }
            })
        },
        error: function()
        {
            response.error("Friend not found");
        }
    });
});

Parse.Cloud.define("send_invites", function(request, response)
{
    var Mailgun = require('mailgun');
    Mailgun.initialize('sandbox5f586396551240e5b00361e2661a613d.mailgun.org', 'key-303a7c2b78e701dc87bca3e4685f5b4c');

    var query = new Parse.Query("Current_Games");
    query.equalTo("GameID", request.params.GameID);
    bcc_string = "";
    var players = request.params.InviteList;
    for (i = 0; i < players.length; i++)
    {
        bcc_string += players[i]+ "@u.northwestern.edu";
        if(i != (players.length - 1))
        {
            bcc_string += ", ";
        }
    }
    console.log(bcc_string);

    query.find({
        success: function(results)
        {
            //calculates new date
            var d = results[0].get('Start_Time');
            utc = d.getTime() + (d.getTimezoneOffset() * 60000);
            new_date = new Date(utc + (3600000*-5));//make sure to change this for daylights savings time
            var monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            //response.success("You've been invited by " + request.params.PlayerID + " to a " + results[0].get('Sport') + " game at " + results[0].get('Location_Name') + " on " + monthNames[new_date.getMonth()] + " " + new_date.getDate() + " at " + new_date.getHours() + ":" + new_date.getMinutes() + "!");
            Mailgun.sendEmail({
              to: bcc_string,//bcc_string;
              from: "Mailgun@CloudCode.com",
              subject: "You've been invited to a game!",
              text: "You've been invited by " + request.params.PlayerID + " to a " + results[0].get('Sport') + " game at " + results[0].get('Location_Name') + " on " + monthNames[new_date.getMonth()] + " " + new_date.getDate() + " at " + new_date.getHours() + ":" + new_date.getMinutes() + "!"
          }, {
              success: function(httpResponse) {
                console.log(httpResponse);
                response.success("Email sent!");
            },
            error: function(httpResponse) {
                console.error(httpResponse);
                response.error("Uh oh, something went wrong");
            }
        });

        }

    });
    /*
    Mailgun.sendEmail({
  bcc = bcc_string;
  from: "Mailgun@CloudCode.com",
  subject: "You've been invited to a game!",
  text: "";
}, {
  success: function(httpResponse) {
    console.log(httpResponse);
    response.success("Email sent!");
  },
  error: function(httpResponse) {
    console.error(httpResponse);
    response.error("Uh oh, something went wrong");
  }
});
*/
});

Parse.Cloud.define("view_games", function(request, response)
{
    //gets list of playerss
    var player = new Parse.Query("Players");
    player.equalTo("PlayerID", request.params.PlayerID);
    var game_info = []; //used to store game data
    var player_info; 
    player.find().then(function(results)
    {
        //used to store player data
        player_info = results;
        //console.log(player_info);
    }).then(function(results)
    {
        for(i=0; i<player_info.length; i++)
        {
            var game = new Parse.Query("Current_Games");
            console.log(player_info[i].get('GameID'));
            game.equalTo("GameID", player_info[i].get('GameID'));
            game.find({
                success: function(results)
                {
                    console.log("here are the ");
                    game_info.push(results);
                },
                error: function()
                {
                    response.error("Game not found");
                }
            });
        }
    }).then(function(results)
    {
        console.log("in here");
        response.success(game_info);        
    }, function(error)
    {
        response.error("lookup failed");
    })
});

/*
player.find({
    success:function(results)
    {
        for(i=0; i<results.length; i++)
        {
            var game = new Parse.Query("Current_Games");
            game.equalTo("GameID", results[i].get('GameID'));
            game.find({
                success: function(results)
                {
                    player_info.push(results);
                },
                error: function()
                {
                    response.error("Game not found");
                }
            });
        }
        response.success(player_info);
    },
    error:function()
    {
        response.error("Game lookup failed");
    }
});
*/