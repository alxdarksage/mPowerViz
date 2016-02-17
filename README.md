# mPowerViz

Visualization view for mPower

# To Use

* load index.html in a web view
* when the page reports it is loaded, call window.display("users-session-guid");
* the page will set window.displayLoaded to true when the data has been retrieved and the visualizations have been loaded. The page fades in.
* if the page encounters any kind of problem, the variable window.displayError will have a text message indicating the error. (Otherwise it is null).

