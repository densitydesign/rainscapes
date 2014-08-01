//define general variables
var svg,
    container="#viz",
    width = $(container).width(),
    height = $(container).height(),
    data,
    path,
    currRain,
    statenames=["california","oregon","washington"],
    statecells={"washington":216, "oregon":263,"california":423},
    currState=thiscountry,
    currDate,
    timescale,
    cursor,
    barWidth=30,
    maxsums=[],
    actualsums={},
    dstop="M-5,15L-5,25L5,25L5,15Z",
    dplay="M-4,13L-4,27L7,21Z",
    playing = true,
pressed = false,
    checktime,
    goAhead;

var currRow=-1;

$("#info").css("left",(width-1150)/2)

var findCounties = function(counties,id){
    geoms = counties.geometries;
    var newGeoms = geoms.filter(function(e){
        return parseFloat(e.id)>id*1000 &&  parseFloat(e.id)<(id+1)*1000
    })

    counties.geometries = newGeoms;
    return counties;

}


//define type of projection, scale and center of map
var projection = d3.geo.mercator()
   // .scale(4000)
    .translate([width/2, height/2] )
    .precision(0);

var y = d3.scale.linear()
    .range([0,70]);

var bary = d3.scale.linear()
    .range([0,200]);

var yAxis = d3.svg.axis()
    .scale(bary)
    .orient("left");

var area = d3.svg.area()
    .x(function(d) { return timescale(new Date(d.Year, d.Month-1, d.Day  )); })
    .y0(height-170)
    .y1(function(d) { return (height-170) - y(parseFloat(d[currState.toLowerCase()])) });


//create the SVG in the html page, define width an height
    svg = d3.select(container).append("svg")
    .attr("width", width)
    .attr("height", height);


var defs= svg
    .append('defs')

    defs.append('pattern')
    .attr('id', 'vertical')
    .attr('patternUnits', 'userSpaceOnUse')
    .attr('width', 2)
    .attr('height', 2)
    .append('path')
    .attr('d', 'M0,0 L0,1')
    .attr('stroke', '#000000')
    .attr('stroke-width', 1);


//load the data files, wait for ready
queue()
    .defer(d3.json, "data/states_centers.json")
    .defer(d3.json, "data/us.json")
    //.defer(d3.json, "data/ciao.json")
    .defer(d3.csv, "data/"+currState.toLowerCase()+"_days.csv")
    .defer(d3.csv, "data/coordinates.csv")
    .defer(d3.csv, "data/"+currState.toLowerCase()+"_disasters.csv")
    .defer(d3.csv, "data/sum_days.csv")
    .await(ready);

//when ready, draw!
function ready(error, centers,states, raindata, coords, disasters,sum) {

    if(error) console.log("error");

    var map = svg.append("g")
        .attr("class","map")

    var rain = svg.append("g")
        .attr("class","rain")

    var events = svg.append("g")
        .attr("class","events")

    var interface = svg.append("g")
        .attr("class","interface")

    var barchart = svg.append("g")
        .attr("class","barchart")
        .attr("transform","translate("+(((width-1200)/2)+1200-100)+","+height*0.20+")");

    var cursorg = svg.append("g")
        .attr("class","cursor-g")

    disasters=disasters.sort(function(a,b){
        return new Date(a.BEGIN_DATE) - new Date(b.BEGIN_DATE);
    })
        .filter(function(a){
            return new Date(a.BEGIN_DATE).getFullYear()<2014
        })


    sum.sort(function(a,b){
        return new Date(a.Year, a.Month-1, a.Day) - new Date(b.Year, b.Month-1, b.Day);
    })


    console.log(disasters)


   for(i in statenames) {
       actualsums[statenames[i]]=0;
       var s = d3.sum(sum,function(e){
           return e[statenames[i]];
       })
       s = s / statecells[statenames[i]]
       maxsums.push(s);
   }

    var sumbounds = d3.extent(sum,function(e){
        return parseFloat(e[currState.toLowerCase()])
    })

    y.domain([0,sumbounds[1]]);
    bary.domain([0,d3.max(maxsums)]);

    projection.center([0,centers[currState][1]])
        .rotate([centers[currState][0],0])
        .scale(width*centers[currState][2]);


    path = d3.geo.path()
        .projection(projection);

    coords.forEach(function(d,i){
        var position = projection([d.Longitude, d.Latitude]);
        d.x = position[0];
        d.y = position[1];
        d.r = 2;

    })

    var tile = d3.geo.tile()
        .scale(projection.scale() * 2 * Math.PI)
        .translate(projection([0, 0]))
        .size([width, height])
        .zoomDelta((window.devicePixelRatio || 1) - .5);

    var tiles = tile();
	

 $(".loading").animate({opacity: 0}, function() {
        $(this).remove()
    });

    $(".loading-white").animate({opacity: 0}, function() {
        $(this).remove()
    });
    map.selectAll("image")
        .data(tiles)
        .enter().append("image")
        .attr("xlink:href", function(d) { return "http://api.tiles.mapbox.com/v2/mariasilvia.ip2o67pb/" + d[2] + "/" + d[0] + "/" + d[1] + ".jpg"; })
       // .attr("xlink:href", function(d) { return "http://" + ["a", "b", "c", "d"][Math.random() * 4 | 0] + ".tiles.mapbox.com/v2/mapbox.natural-earth-2/" + d[2] + "/" + d[0] + "/" + d[1] + ".png"; })
        .attr("width", parseInt(Math.round(tiles.scale))+1)
        .attr("height", Math.round(tiles.scale)+1)
        .attr("x", function(d) { return parseInt(Math.round((d[0] + tiles.translate[0]) * tiles.scale)); })
        .attr("y", function(d) { return parseInt(Math.round((d[1] + tiles.translate[1]) * tiles.scale)); });

    var cent = map.append("path")
        .datum(topojson.merge(states, states.objects.states.geometries.filter(function (a) {
            return a.id===centers[currState][3];
        })))
        .attr("class", "vip-states")
        .attr("d", path);

    var counties = map.append("path")
        .datum(topojson.feature(states, findCounties(states.objects.counties,centers[currState][3])/*.filter(function (a) {
            return parseFloat(a.gemotries.id)>centers[currState][3]*1000 && parseFloat(a.geometries.id)<(centers[currState][3]+1)*1000;
        })*/))
        .attr("class", "vip-counties")
        .attr("d", path);


    var ext = d3.extent(raindata,function(e){
        return new Date(e.Year, e.Month-1, e.Day)
    })

    timescale = d3.time.scale().domain(ext).range([200,width-100]);
     currDate=ext[0];


    interface.append("circle")
        .attr("cx",0)
        .attr("cy",20)
        .attr("r",12)
        .attr("class","player frame")
        .style("fill","none")
        .style("stroke", "#E96633")
        .style("stroke-width",2)
        .attr("transform",  "translate("+(110) + ","+(height-270)+")")

   /* interface.append("path")
        .attr("d", "M-4,13L-4,27L7,21Z")
        .style("stroke","none")
        .style("fill", "#E96633")
        .attr("transform",  "translate("+(110) + ","+(height*0.753)+")")
*/


    interface.append("path")
        .attr("class","player button")
        .attr("d", dstop)
        .style("stroke","none")
        .style("fill", "#E96633")
        .attr("transform",  "translate("+(110) + ","+(height-270)+")")
        .on("click",function(){
            if(playing) {
                playing = false;
                d3.select(this)
                    .attr("d",dplay)
            }
            else {
                playing = true;
                checktime = setInterval(goAhead,100);
                d3.select(this)
                    .attr("d",dstop)
            }
        })


    interface.append("line")
        .attr("x1",timescale(ext[0])-100)
        .attr("y1",height-170)
        .attr("x2",timescale(ext[1]))
        .attr("y2",height-170)
        .style("stroke-width",2)
        .style("opacity",0.9)
        .style("stroke","#5095B2")


    for(var i = 0; i<5; i++) {
        interface.append("line")
            .attr("x1",timescale(ext[0]))
            .attr("y1",height-160+i*20+10)
            .attr("x2",timescale(ext[1]))
            .attr("y2",height-160+i*20+10)
            .style("stroke-width",0.1)
            .style("opacity",0.9)
            .style("stroke","#333")

        interface.append("text")
            .attr("x",timescale(ext[0])-100)
            .attr("y",height-160+i*20+10)
            .attr("dy",3)
            .style("fill","white")
            .style("stroke","none")
            //.style("font-size",12)
            .style("font-family","'Crimson+Text',Serif")
            .text(function(){
                if(i==0) return "Hail"
                else if(i==1) return "Thunderstom"
                else if(i==2) return "Wildfire"
                else if(i==3) return "Drought"
                else return "Hurricane"
            })
            .style("font-size",12);


            interface.append("rect")
            .attr("x",0)
            .attr("y",0)
            .attr("transform","translate("+(timescale(ext[0])-10)+","+(height-161+i*20+5)+")rotate(45)")
            .attr("width",10)
            .attr("height",10)
            .style("stroke","none")
            .style('fill',function(){
                if(i==0) return "#367085"
                else if(i==1) return "#554B79"
                else if(i==2) return "#F27338"
                else if(i==3) return "#FEAE22"
                else return "#81969B"
            })
 

    }

    interface.selectAll("disaster")
        .data(disasters).enter()
        .append("rect")
        .attr("class","disaster")
        .attr("x",function(e){return timescale(new Date(e.BEGIN_DATE))})
        .attr("y",function(e){
            if(e.EVENT_TYPE==="Hail") return height-160+5;
            else if(e.EVENT_TYPE==="Thunderstorm Wind") return height-160+25;
            else if(e.EVENT_TYPE==="Wildfire") return height-160+45;
            else if(e.EVENT_TYPE==="Drought") return height-160+65;
            else if(e.EVENT_TYPE==="Tornado") return height-160+85;
        })

        .style("fill",function(e){
            if(e.EVENT_TYPE==="Hail") return "#367085";
            else if(e.EVENT_TYPE==="Thunderstorm Wind") return "#554B79";
            else if(e.EVENT_TYPE==="Wildfire") return "#F27338";
            else if(e.EVENT_TYPE==="Drought") return "#FEAE22";
            else if(e.EVENT_TYPE==="Tornado") return "#81969B";
        })
        .attr("width",1)
        .attr("height",8)
        .style("stroke","none")



    interface.append("line")
        .attr("x1",timescale(ext[0])-100)
        .attr("y1",height-50)
        .attr("x2",timescale(ext[1]))
        .attr("y2",height-50)
        .style("stroke","#333")


    interface.append("path")
        .datum(sum)
        .attr("class", "area")
        .attr("d", area);


    var ticks = interface.selectAll(".timelegend")
        .data(raindata.filter(function(e){
            return e.Month==12 && e.Day==31
        })).enter()
        .append("line")
        .attr("class","timelegend")
        .attr("x1",function(e){return timescale(new Date(e.Year, e.Month-1, e.Day))})
        .attr("y1",0)
        .attr("x2",function(e){return timescale(new Date(e.Year, e.Month-1, e.Day))})
        .attr("y2",15)
        .attr("transform","translate(0,"+(height-50)+")")
        .style("stroke","#333")
        .style("stroke-width",1)
        .style("opacity",1)

    var years = interface.selectAll(".timeyears")
        .data(raindata.filter(function(e){
            return e.Month==7 && e.Day==1
        })).enter()
        .append("text")
        .attr("class","timeyears")
        .attr("text-anchor","middle")
        .attr("x",function(e){return timescale(new Date(e.Year, e.Month-1, e.Day))})
        .attr("y",15)
        .style("font-size",11)
        .attr("transform","translate(0,"+(height-50)+")")
        .text(function(e){return e.Year})
        .style("fill","#333")




    //BARCHART

    barchart.append("text")
        .text("States comparison")
        .attr("text-anchor","middle")
        .style("font-family","'Crimson+Text',serif")
        .style("font-size",12)
        .style("fill","#333")
        .attr("y",-30)
        .attr("x",barWidth*1.3)
        //.attr("transform",  "translate("+( width*0.8) + ","+(height*0.2)+")")

    barchart.append("line")
        .attr("x1",-10)
        .attr("x2",barWidth*3)
        .attr("y1",-25)
        .attr("y2",-25)
        //.attr("transform",  "translate("+( width*0.8) + ","+(height*0.2)+")")
        .style("stroke","#333")
        .style("stroke-width",1);


    var barlabels = barchart.selectAll(".barlbls")
        .data(d3.keys(actualsums))

    var barbars = barchart.selectAll(".barbars")
        .data(d3.keys(actualsums))

    barlabels.enter().append("text")
        .attr("class","barlbls")
        .attr("x",barWidth/4)
        .attr("y",-6)
        .attr("text-anchor","middle")
        .attr("transform", function(d, i) { return "translate("+( i * barWidth) + ",0)"; })
        .text(function(i){return i.substring(0,2)})
        .style("fill",function(e){
            if(e===currState.toLowerCase()) return "#E96633"
            else return "#333"
        })
        .style("stroke","none")
        .style("font-family","'Crimson+Text',serif")
        .style("font-size",12)
        .style("text-transform","capitalize")

    barbars.enter().append("line")
        .attr("x1",0)
        .attr("y1",-2)
        .attr("x2",barWidth/2)
        .attr("y2",-2)

        .attr("transform", function(d, i) { return "translate("+( i * barWidth) + ",0)"; })
        .style("stroke",function(e){
            if(e===currState.toLowerCase()) return "#E96633"
            else return "#333"
        })
        .style("stroke-width",2);


   cursorg.append("line")
        .attr("class","cursor-line")
        .attr("x1",0)
        .attr("y1",55)
        .attr("x2",0)
        .attr("y2",-59)
        .style("stroke-width",1)
        .style("opacity",1)
        .attr("class","cursor")
        .style("stroke","#5095B2")

    cursor = cursorg.append("rect")
        .attr("class","cursor")
        .attr("x",5)
        .attr("y",5)
        .attr("width",10)
        .attr("height",10)
        .style("fill","#333")
        .style("opacity",0.8)
        .style("stroke","none")
        .attr("transform","translate(0,46)rotate(45)")

    cursorg.append("rect")
        .attr("x",-40)
        .attr("y",-10)
        .attr("width",80)
        .attr("height",90)
        .style("fill","none")
        .style("stroke","none");

    cursorg
        .attr("transform","translate("+(timescale(ext[0]))+","+(height-110)+")")
        .on("mousedown", function(){
            clearInterval(checktime);
            playing=false;
            pressed = true;
        })


        svg
        .on("mousemove", function(){

            if(pressed) {

                var t = d3.transform(cursorg.attr("transform")),
                    xc = t.translate[0];

                xdrag = d3.mouse(this)[0];
                if (xdrag < timescale.range()[0]) xdrag = timescale.range()[0]
                if (xdrag > timescale.range()[1]) xdrag = timescale.range()[1]

                var d = timescale.invert(xdrag)
                console.log(d)
                    d3.select(".timelbl").text(function(){return d.getDate()+"/"+ (d.getMonth()+1)+"/"+d.getFullYear()})


               cursorg
                    .attr("transform", "translate(" + (xdrag) + "," + (height-110) + ")")
            }
        })
        .on("mouseup", function(){

            if(pressed) {

                for(j in statenames) {
                    actualsums[statenames[j]]=0;
                }

                d3.select(".player.button")
                    .attr("d",dplay)

                d3.select(".timelbl").remove();

                pressed = false;
                xdrag = d3.mouse(this)[0];
                if (xdrag < timescale.range()[0]) xdrag = timescale.range()[0]
                if (xdrag > timescale.range()[1]) xdrag = timescale.range()[1]



                d3.select(this)
                    .attr("transform", "translate(" + xdrag + "," + (height-110) + ")")

                var dat = timescale.invert(xdrag)
                barchart.selectAll(".year-lbl").remove();

                for (var i = 0; i < raindata.length; i++) {
                    if (raindata[i].Day == dat.getDate() && raindata[i].Month == dat.getMonth() + 1 && raindata[i].Year == dat.getFullYear()) {
                        currRow = i;
                        break;
                    }
                    else {

                        currSum = sum[i]
                        for(j in statenames) {
                            actualsums[statenames[j]]+=parseFloat(currSum[statenames[j]])/statecells[statenames[j]]
                        }

                        if(currSum.Month==12 && currSum.Day==31) {
                            console.log("new year's day!")


                            barchart
                                .append("path")
                                .attr("class", "year-lbl")
                                .style("stroke","#333")
                                .style("stroke-width",0.5)
                                .style("fill","none")
                                .attr("d",function(){
                                    e=d3.values(actualsums);

                                    return "M0,"+bary(e[0])+"L"+barWidth/2+","+bary(e[0])+"L"+barWidth+","+bary(e[1])+"L"+barWidth*1.5+","+bary(e[1])+"L"+barWidth*2+","+bary(e[2])+"L"+barWidth*2.5+","+bary(e[2])+"L"+barWidth*3.5+","+bary(e[2]);
                                })

                            barchart.append("text")
                                .attr("class", "year-lbl")
                                .attr("x",barWidth*2.75)
                                .attr("y",bary(d3.values(actualsums)[2])-2)
                                .text(currSum.Year)
                                .attr("font-size",10)
                                .style("fill","#333");

                        }



                    }
                }


                plotRain();
            }

        });



    plotRain = function() {

        if(!playing) {
            rain.selectAll("circle").remove();
            events.selectAll("circle").remove();
        }

        currRain = raindata[currRow];
        currSum = sum[currRow]
        currDate = new Date(currRain.Year, currRain.Month-1, currRain.Day);

        for(i in statenames) {
            actualsums[statenames[i]]+=parseFloat(currSum[statenames[i]])/statecells[statenames[i]]
        }

         var bar = barchart.selectAll(".bars")
             .data(d3.values(actualsums))

            bar.enter()
             .append("rect")
                .style("fill","#99BED2")
                .style("stroke","none")
                .style("opacity",0.8)

            bar
             .attr("class","bars")
             .attr("transform", function(d, i) { return "translate("+(i * barWidth) + ",0)"; })
             .attr("width",barWidth*0.5)
                .transition()
                .duration(function(){
                    if(playing) return 0;
                    else return 500;
                })
             .attr("height",function(e){return bary(e)})
             .attr("x",0)
             .attr("y",0)

         if(currDate.getMonth()==11 && currDate.getDate()==31) {
             console.log("new year's day!")


             barchart
                 .append("path")
                 .attr("class", "year-lbl")
                 .style("stroke","#333")
                 .style("stroke-width",0.5)
                 .style("fill","none")
                 .attr("d",function(){
                     e=d3.values(actualsums);

                     return "M0,"+bary(e[0])+"L"+barWidth/2+","+bary(e[0])+"L"+barWidth+","+bary(e[1])+"L"+barWidth*1.5+","+bary(e[1])+"L"+barWidth*2+","+bary(e[2])+"L"+barWidth*2.5+","+bary(e[2])+"L"+barWidth*3.5+","+bary(e[2]);
                 })

             barchart.append("text")
                 .attr("class", "year-lbl")
                 .attr("x",barWidth*2.75)
                 .attr("y",bary(d3.values(actualsums)[2])-2)
                 .text(currDate.getFullYear())
                 .attr("font-size",10)
                 .style("fill","#333");

         }


        if(currDate.getMonth()==0 && currDate.getDate()==1 && currDate.getFullYear()==2004) {

            for(i in statenames) {
                actualsums[statenames[i]] = 0;
            }

            d3.selectAll(".year-lbl").transition().duration(300).style("opacity",0).remove();

        }


        cursorg
            .attr("transform","translate("+(timescale(currDate))+","+(height-110)+")");

         //cursor.attr("transform","translate("+(timescale(currDate))+","+(height*0.9+54)+")rotate(45)")

         d3.select(".cursor-line")
             .attr("x1",function(){return timescale(currDate)})
             .attr("x2",function(){return timescale(currDate)})

        var disastercrcl = events.selectAll(".disasters-halo")
            .data(disasters.filter(function(e){

            return new Date(e.BEGIN_DATE).getTime() == currDate.getTime();
        })).enter()
            .append("circle")
            .attr("class","disasters-map disasters-halo "+"num"+currRow)
            .attr("cx",0)
            .attr("cy",0)
            .attr("r",5)
            .attr("transform",function(e){return "translate("+projection([parseFloat(e.BEGIN_LON), parseFloat(e.BEGIN_LAT)])+")rotate(45)"})
            .style("fill","white")
            .style("stroke","white")
            .style("fill-opacity",0.2)
            .style("stroke-opacity",0.7)
            //.style('fill', 'url(#vertical)')
            .attr("stroke-width",1)
            .style("opacity",1)
            .transition()
            .duration(500)
            .attr("r",15)

      /*  if(playing) {

        disastercrcl
            .transition()
                .delay(1000)
                .duration(1000)
                .style("opacity", 0)
                .each("end",
                function () {
                    d3.select(this).remove()
                })
        }*/

        var disasterhalo = events.selectAll(".disasters-circle")
            .data(disasters.filter(function(e){

                return new Date(e.BEGIN_DATE).getTime() == currDate.getTime();
            })).enter()
            .append("circle")
            .attr("class","disasters-map disasters-circle "+"num"+currRow)
            .attr("cx",0)
            .attr("cy",0)
            .attr("r",3)
            .attr("transform",function(e){return "translate("+projection([parseFloat(e.BEGIN_LON), parseFloat(e.BEGIN_LAT)])+")rotate(45)"})
            .attr("fill",function(e){
                if(e.EVENT_TYPE==="Hail") return "#367085";
                else if(e.EVENT_TYPE==="Thunderstorm Wind") return "#554B79";
                else if(e.EVENT_TYPE==="Wildfire") return "#F27338";
                else if(e.EVENT_TYPE==="Drought") return "#FEAE22";
                else if(e.EVENT_TYPE==="Tornado") return "#81969B";
            })
            .attr("stroke","none")
            //.style('fill', 'url(#vertical)')
            .attr("stroke-width",2)
            .style("opacity",1)

           /* if(playing) {

                disasterhalo.transition()
                    .delay(1000)
                    .duration(1000)
                    .style("opacity", 0)
                    .each("end",
                    function () {
                        d3.select(this).remove()
                    })
            }*/


        for (a in currRain) {

            if (a !== "Month" && a !== "Day" && a !== "Year" && currRain[a]>0) {

                rain.append("circle")
                    .attr("class","num"+currRow)
                    .datum(currRain[a])
                    .style("opacity",1)
                    .attr("cx", function () {
                        c = coords.filter(function (d) {
                            return d.ID === a.substring(3)
                        })

                        return c[0].x
                    })
                    .attr("cy", function () {
                        c = coords.filter(function (d) {
                            return d.ID === a.substring(3)
                        })
                        return c[0].y
                    })
                    .style("fill", "#99BED2")
                    .style("opacity",1)
                    .style("stroke", "none")
                    .attr("r",0)
                    .transition()
                    .duration(500)
                    .attr("r", function (s) {
                        if(currState!=="California")
                        return Math.sqrt((currRain[a] * 1.86 * width)/(2*Math.PI));
                        else return Math.sqrt((currRain[a] * 0.82*width)/(2*Math.PI));
                    })

            }
        }

        interface.append("text")
            .datum(currRain)
            .attr("class","timelbl")
            .text(function(d){return d.Day+"/"+ d.Month+"/"+d.Year})
            .attr("x",30)
            .attr("y",30)
            .attr("font-family","'Roboto',sans-serif")
            .attr("transform",  "translate("+( 110) + ","+(height-272)+")")
            .attr("fill","#333")
            .attr("font-size",20)


    }


    goAhead = function() {

        if(playing) {

            d3.selectAll(".num" + currRow)
                .transition()
                .duration(function (e) {
                    return d3.max([1000, e * 15000])
                })
                .delay(500)
                //.attr("r",0)
                .style("opacity", 0)
                .each("end",
                function () {
                    d3.select(this).remove()
                })


            currRow++;
            if (currRow == raindata.length) currRow = 0;
            d3.select(".timelbl").remove()

            plotRain();
        }
    }


    checktime = setInterval(goAhead,200);

    onMouseUp = function() {

    }

    


}

