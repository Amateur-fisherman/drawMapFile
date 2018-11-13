var importFile = {
    render:function(){
        var me = this;
        var fileDom=$('#file');

        $(fileDom).change(function(){
            var that=this;
            //获取读取我文件的File对象
            var selectedFile = this.files[0];
            var reader = new FileReader();//这是核心,读取操作就是由它完成.
            reader.readAsText(selectedFile);//读取文件的内容,也可以读取文件的URL
            reader.onload = function () {
                //当读取完成后回调这个函数,然后此时文件的内容存储到了result中,直接操作即可
                var str=this.result;

                // //操作解析的内容
                var fileDataObj=me.fileData(str,selectedFile);
                var fileContent=fileDataObj.fileContent;
                var blob = new Blob([fileContent],{type : 'text/html'});
                //提交到文件服务器
                var formFile = new FormData();
                formFile.append('file', blob);
                //formFile对象可传到服务端保存
                // $.ajax({
                //     url: '/path/to/file',
                //     type: 'POST',
                //     contentType:false,
                //     processData: false,
                //     data: formFile,
                //     success:function(){

                //     }
                // })

                //传递数据到表单
                var postFormData=fileDataObj.coordinate;
                var points=postFormData.points;
                me.getPointCity(postFormData.points,0,[],function(points){
                    postFormData.points=points;
                    me.getCity(
                        [postFormData.startLng,postFormData.startLat],
                        [postFormData.endLng,postFormData.endLat],
                        function(startAddress,endAddress){
                            console.log(startAddress,endAddress);
                    })
                    //绘制地图
                    var lineArr=fileDataObj.lineArr;
                    var markerList=fileDataObj.markerList;
                    me.drawMap(lineArr,markerList,function(url){
                        console.log(postFormData);
                    });
                })
                
            }
        })
    },
    batchPointToAddr:function(locations,cb){
        $.ajax({
            url: 'https://restapi.amap.com/v3/geocode/regeo?parameters&key=9258b89bd965818556fd49672314e367&batch=true&location='+locations,
            type: 'get',
            dataType: 'json',
            success:function(res){
                cb&cb(res);
            }
        })
    },
    getPointCity:function(points,start,p,cb){
        if(points.length){
            var me=this;
            var start=start||0;
            //20是批量转换的临界值
            var me=this;
            var end=start+20;
            if(points.length>end){
                var arr=points.slice(start,end);
            }else{
                var arr=points.slice(start,points.length);
            }
            var locations='';
            for(var i=0;i<arr.length;i++){
                locations+=arr[i].lng+','+arr[i].lat+'|'
            }
            me.batchPointToAddr(locations,function(res){
                for(var j=0;j<res.regeocodes.length;j++){
                    arr[j].cityName=res.regeocodes[j].addressComponent.province+res.regeocodes[j].addressComponent.city;
                }
                p=p.concat(arr);
                if(points.length>p.length){
                    me.getPointCity(points,end,p,cb)
                }else{
                    cb&&cb(p);
                }
            })
        }else{
            cb&&cb(p);
        }
    },
    gpsCovertGord:function(lineArr,start,gords,cb){
        $('#loading').show();
        //1000是批量转换高德点的临界值
        var me=this;
        var end=start+1000

        if(lineArr.length<=end){
            end=lineArr.length
        }

        var arr=lineArr.slice(start,end);
        AMap.convertFrom(arr, 'gps', function (status, result) {
            if (result.info === 'ok') {
                var lnglats = result.locations;
                gords=gords.concat(lnglats);
                if(lineArr.length>end){
                    me.gpsCovertGord(lineArr,end,gords,cb);
                }else{
                    cb&&cb(gords);
                }
            }
        })
    },
    drawMap:function(lineArr,markerList,cb){
        var me = this;
         //gps点转换高德的点
        me.gpsCovertGord(lineArr,0,[],function(gords){
            var satellite = new AMap.TileLayer.Satellite();
            var roadNet = new AMap.TileLayer.RoadNet();

            var map = new AMap.Map('amap', {
                resizeEnable: true,
                zoom: 12,
                layers:[
                    satellite,
                    roadNet
                 ]
            });

            var startPoint=gords[0];
            var endPoint=gords[gords.length-1];

            var startMarker = new AMap.Marker({
                position:[startPoint.lng, startPoint.lat],
                icon:"images/start-marker.png",
                offset: new AMap.Pixel(-34, -60), //相对于基点的偏移位置
            })
            var endMarker = new AMap.Marker({
                position:[endPoint.lng, endPoint.lat],
                icon:"images/end-marker.png",
                offset: new AMap.Pixel(-34, -60), //相对于基点的偏移位置
            })

            map.add(startMarker);
            map.add(endMarker);
            map.add(markerList);
            map.plugin(["AMap.ToolBar"],function(){
                //加载工具条
                var tool = new AMap.ToolBar();
                map.addControl(tool);   
            });
            //绘制轨迹  
            var polyline = new AMap.Polyline({  
                map:map,  
                path:gords,  
                strokeColor:"#00E080",//线颜色  
                strokeOpacity:1,//线透明度  
                strokeWeight:8,//线宽  
                strokeStyle:"solid",//线样式
                showDir: true   
            });

            map.setFitView([polyline]);
            
            AMap.event.addListener(satellite, "complete",function(){
                AMap.event.addListener(roadNet, "complete",function(){
                    AMap.event.addListener(map,"complete", me.handler(cb));
                });
            });
        })
    },
    handler:function(cb){
        var me=this;
        me.listenCanvas(function(canvas){
            var newCanvas = document.createElement('canvas');
            newCanvas.id= "CursorLayer";     
            newCanvas.width = 770;
            newCanvas.height = 500;
            var context = newCanvas.getContext('2d');

            var imgs=$('.amap-layer').find('img');

            var top,left;
            var i=0;
            diedai(i);
            function diedai(i){
                var imgDom=imgs[i];
                var img = new Image();
                img.crossOrigin="*";
                img.src=imgDom.src+'&_='+Date.now();
                img.onload=function(){
                    top=$(imgDom).position().top+250;
                    left=$(imgDom).position().left+385;
                    context.drawImage(img,left,top,256,256);

                    if(i<imgs.length-1){
                        i++;
                        diedai(i);
                    }else{
                        var c1=canvas[0];
                        var c2=canvas[1];
                        var img1=me.canvasToImage(c1);
                        var img2=me.canvasToImage(c2);

                        img2.onload = function(){
                            context.drawImage(img2,0,0,770,500);
                            context.drawImage(img1,0,0,770,500);
                            $('body').append(newCanvas);
                            var base64Data = newCanvas.toDataURL("image/jpeg", 1.0);
                            //封装blob对象
                            var blob = me.dataURItoBlob(base64Data);

                            var imgObj=new FormData();
                            imgObj.append('file',blob);
                            //上传到文件服务器
                            $('#loading').hide();
                        }
                    }
                }
            }
        });
    },
    listenCanvas: function(cb){
        var mapDom=$('.amap');
        var timeId = setInterval(function(){
            var canvas=mapDom[0].getElementsByTagName('canvas');
            if (canvas.length === 2) {
                clearInterval(timeId);
                cb(canvas);
            }
            
        }, 100);
    },
    dataURItoBlob:function(base64Data) {
        var byteString;
        if (base64Data.split(',')[0].indexOf('base64') >= 0)
            byteString = atob(base64Data.split(',')[1]);
        else
            byteString = unescape(base64Data.split(',')[1]);
        var mimeString = base64Data.split(',')[0].split(':')[1].split(';')[0];
        var ia = new Uint8Array(byteString.length);
        for (var i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        return new Blob([ia], {type: mimeString});
    },
    canvasToImage:function(canvas) {
        var image = new Image();
        image.src = canvas.toDataURL("image/png");  //把canvas转换成base64图像保存
        return image;
    },
    getCity:function (startlnglatXY,endlnglatXY,cb){
       var me=this;
       var locations=startlnglatXY.join()+'|'+endlnglatXY.join();
       me.batchPointToAddr(locations,function(res){
            var startAddress=res.regeocodes[0].addressComponent.province+res.regeocodes[0].addressComponent.city;
            var endAddress=res.regeocodes[1].addressComponent.province+res.regeocodes[1].addressComponent.city;
            cb&&cb(startAddress,endAddress);
       })
    },
    formatDate:function (date, format) {
        if (!Date.prototype.format) {
            Date.prototype.format = function (fmt) {
                var o = {
                    "M+": this.getMonth() + 1, 
                    "d+": this.getDate(),
                    "h+": this.getHours() % 12,
                    "H+": this.getHours(),
                    "m+": this.getMinutes(),
                    "s+": this.getSeconds(),
                    "q+": Math.floor((this.getMonth() + 3) / 3),
                    "S": this.getMilliseconds()
                };
                if (/(y+)/.test(fmt))
                    fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
                for (var k in o)
                    if (new RegExp("(" + k + ")").test(fmt))
                        fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
                return fmt;
            }
        }

        if (date) {
            return new Date(date).format(format);
        } else {
            return '';
        }
    },
    sec_to_time :function(s) {
        var t;
        if(s||s==0){
            if (s > -1) {
                var hour = Math.floor(s / 3600);
                var min = Math.floor(s / 60) % 60;
                var sec = s % 60;
                if (hour < 10) {
                    t = '0' + hour + ":";
                } else {
                    t = hour + ":";
                }

                if (min < 10) { t += "0"; }
                t += min + ":";
                if (sec < 10) { t += "0"; }
                t += sec;
            }
        }else{
            t=s
        }
        
        return t;
    },
    fileData:function(str,selectedFile){
        $('#loading').show();
        var me = this;
        //当读取完成后回调这个函数,然后此时文件的内容存储到了result中,直接操作即可
        var fileType=selectedFile.name.split('.')[1];
        var lngX , latY ,lineArr=new Array(),fileContent=[],altitude,maxAltitude,minAltitude,average=0,upAltitude=0,downAltitude=0;
        var prevAltitude,startTime='',endTime='',duration='',maxSpeed='',avgSpeed='';
        //打点信息
        var lng='',lat='',alt,saveTime,pointObj={},points=[],markerList=[];
        if(fileType=='kml'){
            //kml 2.1版本
            if(str.indexOf('<LineString>') != -1 ){
                str=$(str).find('LineString').find('coordinates').text().replace(/^[\n\r]+|[\n\r]+$/g,"").replace(/\s/g,'\n').replace(/\n+$/,"");
                str=str.split('\n');
                for(var i=0;i<str.length;i++){
                    var pointInfo=str[i].split(',');
                    lngX = parseFloat(pointInfo[0]);
                    latY = parseFloat(pointInfo[1]);
                    altitude=parseFloat(pointInfo[2]);
                    //此数据渲染地图
                    lineArr.push(new AMap.LngLat(lngX,latY));
                    
                    //此数据上传文件服务
                    fileContent.push(lngX+','+latY+','+altitude);
                    if(i==0){maxAltitude=altitude;minAltitude=altitude;}
                    // 最高海拔
                    if (altitude > maxAltitude) {
                        maxAltitude = altitude;
                    }
                    //最低海拔
                    if (altitude < minAltitude){
                        minAltitude = altitude;
                    }
                    //海拔总数
                    average+=altitude;
                }
            //kml 2.2版本
            }else if(str.indexOf('gx:Track') != -1 ){
                //开始结束时间
                var gxs=str.match(/<gx:coord>(.+)<\/gx:coord>/g);
                var coordinates=str.match(/<coordinates>/g);
                var whens=str.match(/<when>(.+)<\/when>/g);
                coordinates?whens=whens.slice(coordinates.length):'';

                var gxReg=/<gx:coord>(.+)<\/gx:coord>/;
                var tReg=/<when>(.+)<\/when>/;

                var n=whens.length;
                startTime=whens[0].match(tReg)[1];
                endTime=whens[n-1].match(tReg)[1];
                maxSpeed=0;
                for(var i=0;i<n;i++){
                    var pointInfo=gxs[i].match(gxReg)[1].split(' ');
                    lngX = parseFloat(pointInfo[0]);
                    latY = parseFloat(pointInfo[1]);
                    altitude=parseFloat(pointInfo[2]);
                    //此数据渲染地图
                    lineArr.push(new AMap.LngLat(lngX,latY));
                    //此数据上传文件服务
                    fileContent.push(lngX+','+latY+','+altitude);
                    if(i==0){maxAltitude=altitude;minAltitude=altitude;}
                    // 最高海拔
                    if (altitude > maxAltitude) {
                        maxAltitude = altitude;
                    }
                    //最低海拔
                    if (altitude < minAltitude){
                        minAltitude = altitude;
                    }
                    //海拔总数
                    average+=altitude;
                }
            }
            //获取打点信息
            var realPointInfo,lastPoint;
            var realPoint=$(str).find('#realPoint');
            if(realPoint.length){
                for(var r=0;r<realPoint.length;r++){
                    var pointObj={};
                    var $el=$(realPoint[r]);
                    realPointInfo=$el.find('coordinates').text().split(',');
                    lng=realPointInfo[0];
                    lat=realPointInfo[1];
                    alt=realPointInfo[2];
                    saveTime=$el.find('when').text();
                    description=$el.find('name').text();

                    saveTime=me.formatDate(saveTime,'yyyy-MM-dd HH:mm:ss');
                    lastPoint=points[points.length-1];
                    lastlng=lastPoint?lastPoint.lng:'';
                    lastlat=lastPoint?lastPoint.lat:'';
                    if(lng!=lastlng||lat!=lastlat){
                        pointObj.lng=lng
                        pointObj.lat=lat;
                        pointObj.alt=alt;
                        pointObj.saveTime=new Date(saveTime)-0;
                        pointObj.description=description
                        points.push(pointObj);

                        var marker = new AMap.Marker({
                            // zIndex: r+100,  // 海量点图层叠加的顺序
                            icon: 'images/point.png',
                            position: coordtransform.wgs84togcj02(lng, lat),   // 经纬度对象，也可以是经纬度构成的一维数组[116.39, 39.9]
                            title: description,
                            offset: new AMap.Pixel(-20, -23),
                        });
                        markerList.unshift(marker);
                    }
                }
            }
        }else if(fileType=='gpx'){
            var hasSpeedTag=str.indexOf('speed')==-1?false:true;
            var trkpt=$(str).find('trkpt');
            var n=trkpt.length;
            maxSpeed=0;
            trkpt.each(function(index, el) {
               var $el=$(el);
               lngX = parseFloat($el.attr('lon'));
               latY = parseFloat($el.attr('lat'));
               //此数据渲染地图
               lineArr.push(new AMap.LngLat(lngX,latY));

               altitude=parseFloat($el.find('ele').text());
               //此数据上传文件服务
               fileContent.push(lngX+','+latY+','+altitude);

                if(index==0){maxAltitude=altitude;minAltitude=altitude;}
                // 最高海拔
                if (altitude > maxAltitude) {
                    maxAltitude = altitude;
                }
                //最低海拔
                if (altitude < minAltitude){
                    minAltitude = altitude;
                }
                //海拔总数
                average+=altitude;
                if(index==0){
                    startTime=$el.find('time').text();
                }else if(index==n-1){
                    endTime=$el.find('time').text();
                }
            });
            //获取打点信息
            var lastPoint;
            var realPoint=$(str).find('wpt');
            if(realPoint.length){
                for(var r=0;r<realPoint.length;r++){
                    var pointObj={};
                    var $el=$(realPoint[r]);
                    lng = parseFloat($el.attr('lon'));
                    lat = parseFloat($el.attr('lat'));
                    alt=parseFloat($el.find('ele').text());
                    saveTime=$el.find('time').text();

                    saveTime=me.formatDate(saveTime,'yyyy-MM-dd HH:mm:ss');
                    description=$el.find('name').text();
                    lastPoint=points[points.length-1];
                    lastlng=lastPoint?lastPoint.lng:'';
                    lastlat=lastPoint?lastPoint.lat:'';
                    if(lng!=lastlng||lat!=lastlat){
                        pointObj.lng=lng
                        pointObj.lat=lat;
                        pointObj.alt=alt;
                        pointObj.saveTime=new Date(saveTime)-0;
                        pointObj.description=description
                        points.push(pointObj);

                        var marker = new AMap.Marker({
                            // zIndex: r+100,  // 海量点图层叠加的顺序
                            icon: 'images/point.png',
                            position: coordtransform.wgs84togcj02(lng, lat),  // 经纬度对象，也可以是经纬度构成的一维数组[116.39, 39.9]
                            title: description,
                            // offset: new AMap.Pixel(-30, -35), //相对于基点的偏移位置
                        });
                        markerList.unshift(marker);
                    }
                }
            }
        }else{
            // 导入的文件格式错误
            return
        }
        fileContent=fileContent.join(' ');
        //平均海拔
        average=(average/lineArr.length).toFixed(2);
        //总里程
        var dis = (AMap.GeometryUtil.distanceOfLine(lineArr)/1000).toFixed(2);
        //gps总点数
        var gpsCount=lineArr.length;
        if(startTime&&endTime){
            //开始结束时间
            startTime=me.formatDate(startTime,'yyyy-MM-dd HH:mm:ss');
            endTime=me.formatDate(endTime,'yyyy-MM-dd HH:mm:ss');
           
            var sTime =new Date(startTime); //开始时间
            var eTime =new Date(endTime); //结束时间

            var sDuration=(eTime.getTime() - sTime.getTime())/1000;
            //总时间
            duration=me.sec_to_time(sDuration);
            //平均速度
            avgSpeed=parseFloat((dis/(sDuration/3600)).toFixed(2));
            maxSpeed=parseFloat(maxSpeed.toFixed(2));
        }
        console.log('起始时间:'+startTime);
        console.log('结束时间:'+endTime);
        console.log('总时间:'+duration);
        console.log('轨迹点:'+gpsCount);
        console.log('平均速度:'+avgSpeed);
        console.log('海拔范围'+minAltitude+'米~'+maxAltitude+'米');
        console.log('总里程:'+dis);
        var obj={
            startLng:lineArr[0].lng,
            startLat:lineArr[0].lat,
            endLng:lineArr[lineArr.length-1].lng,
            endLat:lineArr[lineArr.length-1].lat,
            maxAltitude:maxAltitude,
            minAltitude:minAltitude,
            average:average,
            distance:dis,
            gpsCount:gpsCount,
            startTime:startTime,
            endTime:endTime,
            duration:duration,
            avgSpeed:avgSpeed,
            points:points
        }
        return {
            lineArr:lineArr,
            coordinate:obj,
            fileContent:fileContent,
            markerList:markerList
        };
    }
}

importFile.render();