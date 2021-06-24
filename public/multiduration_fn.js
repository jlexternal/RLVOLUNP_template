function multiduration_fn(shortFlag,normalDuration,shortDuration) {
// duration function to be used with jspsych-html-keyboard-response-sequential-faded plugin

// normalDuration is an integer array of length > 1,
//   otherwise, use duration_fn.js
ndurs = normalDuration.length;

var dura = {};
if (shortFlag) {
  dura.durations = [];
  dura.durations.length = ndurs;
  dura.durations.fill(shortDuration);
} else {
  dura.durations = normalDuration;
}
return dura;
}
