/* server.js
    Server initialization, server-to-database comms, client-server request handling code

    Note:   This code requires the node.js environment to function properly
    Author: Jun Seok Lee <jlexternal@gmail.com> - May 2021
*/

/*
  Server-side requirements:
    An SQL database with the necessary tables. (see build_database.js)
    The modules imported below (and installed).

  Client-side requirements:
    The URL to access the application MUST have a prolific_id query with
    a 24 character string specifying the Prolific ID.
    (You can get rid of the code that requires this for testing purposes, but if
     using Prolific as the recruitment platform, this will facilitate data
     gathering)

  - JL
*/

// import modules
var http        = require('http');
var fs          = require('fs');
var express     = require('express'); // the experiment is launched through an Express application
var path        = require('path');
var mysql       = require('mysql');
var bodyParser  = require('body-parser');

var buildDB     = require('./build_database'); // custom module that contains functions to build the database

const nsubj     = 2; // number of subjects to build database for
const nblock    = 6;
const ntrial    = 80;

    // arrays to hold queries to be sent to database
var queries_cache1      = [],
    queries_cache2      = [],
    // arrays to hold queries to be printed to console (redundancy for safety)
    queries_cache_block = '',
    queries_cache_other = [];

var app = express();
app.set('port', process.env.PORT || 8000);                // listening port
app.use(express.static(path.join(__dirname, 'public')));  // add specified directory to active path
app.use(bodyParser.urlencoded({ extended: true }));       // needed to read JSON object body in Express

// launch server
var server = http.createServer(app);
server.listen(app.get('port'), function () {
  console.log("Express server listening on port " + app.get('port'));
});

/* _.~"~._.~"~._.~"~._.~"~._ BEGIN: SERVER-DATABASE-related code _.~"~._.~"~._.~"~._.~"~._ */

// details of the mySQL database configuration parameters
var db_config = {
  connectionLimit: 10,

  //*/ // comment or uncomment the 1st / to toggle database choice
  // for use on local machine
  // access local mySQL db via 'mysql -u root' and enter the root password
  host: "localhost",
  user: "test",
  password: "123123",
  database: 'main_db'

  /*/
  // for use on Scalingo
  host:     'hosturl.mysql.dbs.scalingo.com',
  user:     'username',
  password: 'password',
  port:     '00000',
  database: 'database_name'
  //*/
};

var con;
/*
  This function will try to make a one-time connection to the database, and deal with PROTOCOL_CONNECTION_LOST
  errors. It is used one time during server launch to create/check for the database. The rest of the connections
  to the database are handled by the pool.
*/
function handleDisconnect() {
  con = mysql.createConnection(db_config);
  con.connect(function(err) {
    if(err) {
      console.log('error when connecting to db:', err);
      setTimeout(handleDisconnect, 2000);
    }
  });

  con.on('error', function(err) {
    console.log('db error', err);
    if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
      handleDisconnect();                         // lost due to either server restart, or a
    } else {                                      // connnection idle timeout (the wait_timeout
      throw err;                                  // server variable configures this)
    }
  });
}
handleDisconnect();

// use pooled SQL connections
const pool = mysql.createPool(db_config);

/* Promise-ified versions of the standard SQL query function */

// send a single SQL query to the database using a direct connection
function sendQuery(conn,sql) {
    return new Promise ( (resolve, reject) => {
      conn.query(sql, (error, results, fields) => {
        // SQL error handling
        if(error) {
          return reject(error);
        }
        resolve({results, fields});
      });
    });
}

// sendQuery but the entry is an array of queries (using pool)
async function sendQueryLoop(conn,queryArray) {
  var results_all = [];
  var promises = [];
  for (var query of queryArray) {
    promises.push(
      pool.getConnection(function(err, connection) {
        if (err) throw err; // not connected!
        connection.query(query, (error, results, fields) => {
          connection.release(); // when done with the connection, release it.
          // SQL error handling
          if (error) {
            return error;
          }
          results_all.push(results);
        });
      })
    );
  }
  await Promise.all(promises);
  return results_all;
}

// sendQuery but using the pool
function sendQueryPool(sql) {
  return new Promise ((resolve, reject) => {
    pool.getConnection(function(err, connection) {
      if (err) throw err; // not connected!
      connection.query(sql, (error, results, fields) => {
        connection.release(); // when done with the connection, release it.
        // SQL error handling
        if (error) {
          return reject(error);
        }
        resolve({results, fields});
      });
    });
  });
}

// write to database every 30 seconds
var sendCacheToggle     = 0;
const sendCacheInterval = 30000;

// query batch to database and print for redundancy/backup
function sendCachedQueries() {
  // start the query string for the bulk insert query
  var queries_cache_str = 'INSERT INTO resp_table '+
                          '(unique_id, cond, i_block, i_round, i_trial, seen_feedback, is_correct, choice_position, choice_symbol, reaction_time) VALUES ';

  (new Promise((resolve,reject) => {
    // check the 1st cache
    if (sendCacheToggle == 0) {
      if (queries_cache1.length != 0) {
          //console.log('\n Sending queries from cache 1...'); //debug
          let query_str = queries_cache_str;
          sendCacheToggle = 1;
          queries_cache1.forEach(value => {
            query_str += value;
          });
          query_str = query_str.slice(0,-1) + ';';
          sendQueryPool(query_str)
          .then(resolve());
      } else {
          resolve();
      }
    }
    // check the 2nd cache
    else {
      if (queries_cache2.length != 0) {
          //console.log('\n Sending queries from cache 2...'); //debug
          let query_str = queries_cache_str;
          sendCacheToggle = 0;
          queries_cache2.forEach(value => {
            query_str += value;
          });
          query_str = query_str.slice(0,-1) + ';';
          sendQueryPool(query_str)
          .then(resolve());
      } else {
        resolve();
      }
    }
  }))
  .then(() => {
    // reset cache that has been sent
    if (sendCacheToggle == 1) {
        queries_cache2 = [];
    } else {
        queries_cache1 = [];
    }
  })
  .catch((error) => console.log(error));
}
// send cached queries to db based on predetermined interval
setInterval(function() {
  sendCachedQueries();
},sendCacheInterval);

// if launching the app for the first time, build the tables of the database
async function checkTablesExistence() {
  var check_tables_str = "SHOW TABLES LIKE 'main_table';";
  var qres = await sendQuery(con,check_tables_str);
  var ntables = 0;
  if (qres.results.length == 1) {
    ntables++;
    check_tables_str = "SHOW TABLES LIKE 'task_table';";
    qres = await sendQuery(con,check_tables_str);
    if (qres.results.length == 1) {
      ntables++;
      check_tables_str = "SHOW TABLES LIKE 'resp_table';";
      qres = await sendQuery(con,check_tables_str);
      if (qres.results.length == 1) {
        ntables++;
      }
    }
  }
  console.log('Tables checked');
  return ntables;
}

// check if database is built already, if not, build interval; if so, skip
checkTablesExistence()
.then(function(ntables) {
  if (ntables == 0) {
    console.log('No tables found. Building tables...');
    new Promise(resolve => {
      resolve(buildDB.create_tables());
    }).then(async(queryArray) => {
        var tables_created = await sendQueryLoop(con,queryArray);
        return tables_created;
    }).then(async() => {
        var promises = [];
        var main_table_queryArray = await buildDB.populate_main_table(nsubj);
        var task_table_queryArray = await buildDB.populate_task_table(nsubj,nblock,ntrial);
        promises.push(sendQueryLoop(con,main_table_queryArray));
        promises.push(sendQueryLoop(con,task_table_queryArray));
        await Promise.all(promises);
    }).then(() => {
        console.log('Connection ended (build_tables)');
        console.log('You should manually ensure that task_table is well filled.');
        setTimeout(() => {
          con.end();
        },5000);
    });
  } else if (ntables == 1 | ntables == 2) {
      console.error('Serious error! There are some tables missing! Check database.');
      process.abort();
  } else {
      console.log('All tables found. Awaiting URL request...');
      console.log('Connection destroyed (checkTablesExistence)');
      con.destroy();
  }
});
/* _.~"~._.~"~._.~"~._.~"~._ END: SERVER-DATABASE-related code _.~"~._.~"~._.~"~._.~"~._ */


/* _.~"(_.~"(_.~"(_.~"(_.~"( BEGIN: SERVER-FRONTEND-related code _.~"(_.~"(_.~"(_.~"(_.~"( */

/*
  The main way that the frontend communicates with the server is through HTTP requests, mainly
    GET and (mostly) POST.
  I will try to explain to the best of my ability what is happening in these requests through
    comments below.

  - JL
*/

// create a route for the main page
app.get('/', (req, res) => {
  // the first argument of .get (i.e. '/') is the URL that is accessed
  // 'req' is what is brought in from client, 'res' is what the server resolves

  // get URL parameters (for Prolific ID) (URL parameters are specified after a ? in the URL string)
  var pid = req.query.prolific_id; // The case of prolific_id is important.
                                   // It should be in lowercase, or there may be problems with parsing it

  // make sure that the Prolific ID is exactly 24 characters
  if (pid.length != 24) {
    console.log('The queried Prolific ID is not exactly 24 characters in length! Aborting execution...');
  }

  // post IP address of participant (for debugging purposes)
  var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  console.log('Client with prolific_id = '+pid+' has IP address ' + ip);

  // read the html file containing the experiment
  fs.readFile('public/run_expe.html', function(err, data) {
    return res.end();
  });
  // send the file to client
  res.sendfile('public/run_expe.html');
  /*
    The code in run_expe.html will trigger the POST requests below.

    - JL
  */
});

// SQL queries to update and get information at start of task
async function runGetTaskLoop(nb,nt,pid) {
  /*
    This function is the initial link between the client as a participant and the experiment.
    It checks to see whether the subject has already accessed the study, and if so, blocks them from continuing.
    If they are a new participant, it links a unique identifier pre-established in the database to the
      unique Prolific identifier.
    It then extracts the data needed to pass into the experiment for this specific participant from the
      database into the server, then send that data to the participant (client).
    The function itself is called upon in the 'request_task' POST request below.

    - JL
  */

  // check for repeat of prolific id
  let query_str_check = "SELECT EXISTS(SELECT * FROM main_table WHERE prolific_id = '"+pid+"');";

  let result = await sendQueryPool(query_str_check);

  Object.values(JSON.parse(JSON.stringify(result.results[0]))).map(val => {
    if (val != 0) { // if the EXISTS check is true
        console.log('Duplicate PID case!');
        console.log('Stopping operation for '+pid+'...');
        return false;
    } else {
        console.log('Moving on...');
    }
   });

  // get the first unique_id from server that is not already taken
  let query_str_uid = 'SELECT unique_id, isubj FROM main_table WHERE prolific_id IS NULL LIMIT 1;';
  let query_out_uid = await sendQueryPool(query_str_uid);
  let unique_id     = query_out_uid.results[0].unique_id,
      subj_num      = query_out_uid.results[0].isubj;

  // update main_table with Prolific ID and timestamp start of task
  let query_str_pid = 'UPDATE main_table ' +
                      "SET prolific_id = '" + pid + "', timestamp_task_start = NOW() " +
                      "WHERE unique_id = '" + unique_id + "';";
  try {
      await sendQueryPool(query_str_pid);
      console.log('Organizing task for UID '+ unique_id + '...');
  } catch(err) {
      console.error('Error in querying entry for '+pid+'... Cannot update main_table!');
      return false;
  }

  // get relevant task data for the specific unique ID
  var table_name = 'task_table';
  var traj_all = [];
  var idx_blocks = [];
  for (var ib=1; ib<nb+1; ib++) {
    let traj_block = [];
    let idx_block= [];
    for (var it=1; it<nt+1; it++) {
      // get feedback values for the correct option
      let query_str_traj = 'SELECT correct_choice_feedback FROM '+table_name+' WHERE ' +
                           "unique_id='"+unique_id+"' AND i_block="+ib+" AND i_trial="+it+";";
      let query_out_traj = await sendQueryPool(query_str_traj);
      traj_block.push(query_out_traj.results[0].correct_choice_feedback);

      // get rounds values for the 2 sessions (halves) of the experiment
      if (ib==1 | ib==4) {
        let query_str_idx = 'SELECT i_round FROM '+table_name+' WHERE ' +
                            "unique_id='"+unique_id+"' AND i_block="+ib+" AND i_trial="+it+";";

        let query_out_idx = await sendQueryPool(query_str_idx);
        idx_block.push(query_out_idx.results[0].i_round);
      }
    }
    traj_all.push(traj_block);
    if (ib==1 | ib==4) {
      idx_blocks.push(idx_block); // global idx_block filled here
    }
  }
  // create the task object to be returned
  var task_obj = {
    idx_blocks: idx_blocks,
    traj_all: traj_all,
    unique_id: unique_id,
    subj_num: subj_num
  };
  return task_obj;
}

// listen for request_task POST request from client
app.post('/request_task', (req, res) => {
  console.log('POST request_task requested from client!');
  if (req.body.pid) {
    // get prolific id
    let pid = req.body.pid;

    // variables to send to client
    let traj, idx_blocks, uid, subj_num;

    // get the task data from the DATABASE into the SERVER
    runGetTaskLoop(nblock,ntrial,pid)
      .then(function(result) {
        // error
        if (!result) {
            return false;
        } else {
            // fill variables to send
            idx_blocks = result.idx_blocks;
            traj       = result.traj_all;
            uid        = result.unique_id;
            subj_num   = result.subj_num;
            return true;
        }
      })
      // send the task data in the SERVER to the CLIENT
      .then(function(continueFlag) {
        if (continueFlag) {
          setTimeout(function() { // wait a little bit for the query to be processed
            var task_data = {
              idx_blocks: idx_blocks,
              traj: traj,
              unique_id: uid,
              subj_num: subj_num
            };
            res.send(task_data); // send the obtained data back to client
            res.end();
          },100);
        }
      })
      .catch(console.error); //debug : maybe return an erorr page to client
  }
});

// listen for server calls to query TASK RESPONSES to SQL database
app.post('/post_resp', (req, res) => {
  /*
      This request is made everytime the participant makes a response on a trial.
      Each value passed from the client to the server must be TYPEMATCHED
        to the type set in the database.

      - JL
  */
  if (req.body) {
    var table_name = 'resp_table'; // change to necessary table name
    var data = req.body,
     unique_id = data.unique_id, // CHAR
            cd = data.cond, // CHAR
            ib = data.i_block,
            ir = data.i_round,
            it = data.i_trial,
            fb = data.seen_feedback,
            cr = data.is_correct, //BOOL
            cp = data.choice_position, // CHAR
            cs = data.choice_symbol,
            rt = data.reaction_time;

    // create the query string for the specific trial
    var char_fields = new Set(['unique_id','cond','choice_position']);
    var field_str = '';
    var value_str = '';
    for (var field of Object.keys(data)) {
      // concatenate list of table fields
      field_str += field+', ';
      // concatenate list of values to be input
      if (char_fields.has(field)) {
        // deal w/ CHAR
        value_str += "'" + data[field] + "', ";
      } else if (field == 'is_correct') {
        // deal w/ BOOL
        if (data[field] == 'true') {
          value_str += '1, ';
        } else {
          value_str += '0, ';
        }
      } else {
        // everything else is INT
        value_str += data[field] + ", ";
      }
    }
    value_str = '('+value_str.slice(0,-2)+'),';

    // queue queries to be batch sent
    if (sendCacheToggle == 0) {
        queries_cache1.push(value_str);
    } else {
        queries_cache2.push(value_str);
    }

    // print BULK INSERT query at end of each half-block
    if (it % 40 == 0) {
      queries_cache_block += value_str;
      (new Promise((resolve, reject) => {
        let insert_str = 'INSERT INTO resp_table '+
                         '(unique_id, cond, i_block, i_round, i_trial, seen_feedback, is_correct, choice_position, choice_symbol, reaction_time) VALUES ';
        console.log('Hemi-block response log dump:\n');
        console.log(insert_str.concat(queries_cache_block));
        console.log('\n');
      }))
      .then(queries_cache_block = '');
    } else {
        queries_cache_block += value_str;
    }
    res.send(true);
    res.end();
  } else {
      console.log('Parsed object body is empty!');
      res.send(false);
      res.end();
  }
});

// the below POST requests work similarly as above - JL

// listen for server calls to write PARTICIPANT FEEDBACK to SQL database
app.post('/post_fb', (req, res) => {
  if (req.body) {
    var table_name = 'main_table';
    var data = req.body,
        unique_id = data.unique_id,
        feedback1  = data.entry1,
        feedback2  = mysql.escape(data.entry2); // escape free responses to prevent SQL injections

    var feedback = feedback1.concat('Q0:"' +feedback2.slice(1,-1)+'"');
    var query_str = "UPDATE "+table_name+" SET feedback = '"+feedback+"' "+
                    "WHERE unique_id = '" + unique_id + "';";
    console.log('Prolific id: ' + unique_id + ' sent feedback!');
    queries_cache_other.push(query_str);
    sendQueryPool(query_str)
    .then(() => {
      console.log('Connection released (post_fb)');
    });

    res.send(true);
  }
  res.end();
});

// listen for server calls for participant BONUS if they achieve minimum acceptable score
app.post('/bonus', (req, res) => {
  if (req.body) {
    var unique_id = req.body.unique_id,
        query_str = "UPDATE main_table SET bonus_flag = 1 WHERE unique_id = '" + unique_id + "';";
    console.log('Prolific id: ' + unique_id + ' received a bonus!');
    console.log(query_str);

    queries_cache_other.push(query_str);
    sendQueryPool(query_str)
    .then(() => {
      console.log('Connection released (bonus)');
    });

    res.send(true);
  }
  res.end();
});

// update database with flag and time when task ends
app.post('/end_task', (req, res) => {
  if (req.body) {
    var unique_id = req.body.unique_id;
    var query_str_end_task = 'UPDATE main_table ' +
                             "SET timestamp_task_end = NOW(), task_completion_flag = TRUE " +
                             "WHERE unique_id = '" + unique_id + "';";
    console.log('Prolific id: ' + unique_id + ' has ended the task!');
    console.log(query_str_end_task);
    queries_cache_other.push(query_str_end_task);
    sendQueryPool(query_str_end_task)
    .then(() => {
      console.log('Connection released (end_task)');
    });
    res.send(true);
  }
  res.end();
});

/* _.~"(_.~"(_.~"(_.~"(_.~"( END: SERVER-FRONTEND-related code _.~"(_.~"(_.~"(_.~"(_.~"( */
