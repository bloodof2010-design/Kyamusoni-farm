import React, { useState, useEffect } from 'react';
import { View, Text, Button, FlatList, TextInput, Vibration, Alert } from 'react-native';
import * as Location from 'expo-location';
import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const FARM_NAME = "Kyamusoni Farm";
const db = SQLite.openDatabaseSync('kyamusoni.db');
db.execSync(`CREATE TABLE IF NOT EXISTS holes (
  id INTEGER PRIMARY KEY, lat REAL, lon REAL, status TEXT, note TEXT, dist_last REAL, date TEXT
)`);

function distance(lat1, lon1, lat2, lon2){
  const R=6371e3, toRad=d=>d*Math.PI/180;
  const dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

export default function App(){
  const [holes,setHoles]=useState([]);
  const [current,setCurrent]=useState(null);
  const [target,setTarget]=useState(null);
  const [note,setNote]=useState("");

  useEffect(()=>{
    (async()=>{
      await Location.requestForegroundPermissionsAsync();
      load();
      Location.watchPositionAsync({accuracy:3, distanceInterval:1}, l=>setCurrent(l.coords));
    })();
  },[]);

  const load=()=> setHoles(db.getAllSync('SELECT * FROM holes ORDER BY id DESC'));

  const markHole=async()=>{
    const loc=await Location.getCurrentPositionAsync({});
    const last=db.getAllSync('SELECT * FROM holes ORDER BY id DESC LIMIT 1')[0];
    let d=0; if(last) d=distance(last.lat, last.lon, loc.coords.latitude, loc.coords.longitude);
    db.runSync('INSERT INTO holes (lat,lon,status,note,dist_last,date) VALUES (?,?,?,?,?,?)',
      [loc.coords.latitude, loc.coords.longitude, 'planted', note, d, new Date().toLocaleDateString()]
    );
    setNote(""); load();
  };

  const exportZip = async () => {
    const data = db.getAllSync('SELECT * FROM holes');
    const csv = `id,lat,lon,status,dist_from_last,note,date\n` + data.map(h=>`${h.id},${h.lat},${h.lon},${h.status},${h.dist_last},${h.note},${h.date}`).join('\n');
    const path = FileSystem.documentDirectory + 'Kyamusoni_Farm_Holes.csv';
    await FileSystem.writeAsStringAsync(path, csv);
    await Sharing.shareAsync(path);
  };

  let distToTarget=0;
  if(current && target) distToTarget=distance(current.latitude, current.longitude, target.lat, target.lon);
  if(distToTarget < 1.5 && distToTarget!==0) Vibration.vibrate();

  return(
    <View style={{flex:1, padding:12, paddingTop:50, backgroundColor:'#fff'}}>
      <Text style={{fontWeight:'bold', fontSize:22, color:'green'}}>🌱 {FARM_NAME}</Text>
      <Text>Cocoa Plot - Offline Non-Uniform</Text>
      <Text style={{marginTop:5}}>Total Holes: {holes.length} | Dead: {holes.filter(h=>h.status==='dead').length}</Text>

      <TextInput placeholder="Note e.g. near termite mound" value={note} onChangeText={setNote} style={{borderWidth:1, padding:10, marginVertical:10, borderRadius:8}}/>
      <Button title="📍 MARK HOLE WHERE I STAND" onPress={markHole} color="#2e7d32"/>

      <View style={{flexDirection:'row', gap:10, marginTop:10}}>
        <Button title="📤 Export ZIP / CSV to WhatsApp" onPress={exportZip} />
      </View>

      {target && (
        <View style={{backgroundColor:'black', padding:15, marginTop:10, borderRadius:12}}>
          <Text style={{color:'white'}}>HOLE #{target.id} - {target.note}</Text>
          <Text style={{color:'#0f0', fontSize:32, fontWeight:'bold'}}>{distToTarget.toFixed(1)} m</Text>
          <Text style={{color:'yellow', fontSize:16}}>{distToTarget<1.5? '✅ YOU ARE ON THE HOLE! RE-PLANT HERE' : 'Walk - GPS guiding you...'}</Text>
          <Button title="Close locator" onPress={()=>setTarget(null)}/>
        </View>
      )}

      <FlatList data={holes} style={{marginTop:10}} keyExtractor={i=>i.id.toString()}
        renderItem={({item})=>(
          <View style={{flexDirection:'row', justifyContent:'space-between', padding:12, marginTop:6, borderRadius:8, backgroundColor: item.status==='dead'? '#ffcdd2' : '#e8f5e9'}}>
            <Text onPress={()=>setTarget(item)} style={{flex:1}}>#{item.id} | {item.dist_last?.toFixed(1)}m from last {item.note?`(${item.note})`:''}</Text>
            <Button title="GO" onPress={()=>setTarget(item)}/>
            <View style={{width:5}}/>
            <Button title="DEAD" color="red" onPress={()=>{db.runSync('UPDATE holes SET status=? WHERE id=?',['dead',item.id]); load();}}/>
          </View>
        )}
      />
    </View>
  )
}
