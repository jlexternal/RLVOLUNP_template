function duration_fn(shortFlag,normalDuration,shortDuration) {

var duration;
if (shortFlag) {
  duration = shortDuration;
} else {
  duration = normalDuration;
}

return duration;
}
