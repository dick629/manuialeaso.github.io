'use strict';
// Keys on a shared landscape keep their world coordinates. Separate story instances use the
// floor's real tile, wall and projectile data with their own doors, inhabitants and rewards.
window.GiranTerrainAtlas=(()=>{
  const regions=[
    ['town_orc_fortress_castle orc_fortress_inner',4,32800,32277],['orc_fortress_outer',4,32770,32366],
    ['dwarf_castle_outer',4,33675,32409],
    ['kent_outer siege_v2_kent_outer',4,33153,32771],['ww_outer',4,32671,33399],
    ['heine_outer',4,33515,33395],['giran_outer',4,33622,32670],['aden_outer',4,34080,33213],
    ['bandit_area',4,32754,32790],['gludin_cemetery',4,32595,32893],['death_ruin',4,32810,32873],
    ['giran_jungle spider_forest',4,33221,32783],['bk_outpost',4,32706,33010],
    ['windwood_wasteland',4,32816,33234],['ti_north',0,32484,32845],['ti_orc_village',0,32512,32918],
    ['silent_outer',304,32780,32931]
  ];
  const floors=[
    [90,'arena_pvp'],
    [15,'kent_inner town_kent_castle siege_v2_kent_lord'],[29,'ww_inner town_windwood_castle'],[64,'heine_inner town_heine_castle'],[52,'giran_inner town_giran_castle'],
    [66,'dwarf_castle_inner town_dwarf_castle_castle'],[300,'aden_inner town_aden_castle'],[23,'windwood_dungeon zone_22'],[24,'zone_23'],[45,'zone_24'],[46,'zone_25'],
    [320,'zone_05'],[490,'zone_34'],[491,'zone_35'],[493,'zone_36'],[430,'giant_tomb deceased_tomb'],
    [461,'hidden_lab_darkmagic demon_lab_1'],[466,'hidden_lab_nolife demon_lab_2'],[470,'hidden_seal_spirit'],[456,'hidden_seal_monster'],[410,'hidden_seal_demon'],
    [543,'hidden_antqueen'],[784,'tikal_deep'],[303,'afk_guard_dg_swan'],[440,'town_pirate_village'],
    [58,'town_behemoth'],[535,'dark_elf_sanctuary cursed_dark_elf_sanctuary'],[534,'collapsed_elder_council_hall'],
    [83,'oblivion_travel'],[70,'oblivion_island'],[31,'antharas_nest_1'],[32,'antharas_nest_2'],[33,'antharas_nest_3'],[37,'antharas_lair'],
    [59,'cr_fafurion_nest_1'],[60,'cr_fafurion_nest_2'],[61,'cr_fafurion_nest_3'],[65,'cr_fafurion_lair'],
    [67,'cr_valakas_lair afk_solo_firedragon'],[605,'cr_valakas_nest_1'],[608,'cr_valakas_nest_2'],[603,'cr_valakas_nest_3'],
    [606,'cr_lindvior_nest_1'],[606,'cr_lindvior_nest_2'],[457,'cr_lindvior_nest_3'],[606,'cr_lindvior_lair wind_dragon_lair'],
    [37,'dv_dungeon_7'],[777,'dark_dragon_scar afk_halpas_nest'],[474,'golem_lab'],[74,'icequeen_palace afk_solo_ice'],
    [608,'ivory_yahee afk_flame_depth'],[101,'town_rift time_room twisted_spacetime'],[75,'town_ivory_tower'],[62,'town_sherine afk_guard_dg_moon'],
    [420,'afk_final_sea'],[522,'afk_traitor_whisper afk_guard_dg_shadow'],[471,'afk_giltas_altar'],[16,'afk_hardin_time'],
    [551,'afk_ghostship'],[782,'afk_starroad afk_zodiac'],[470,'afk_soul_room afk_solo_soul'],[452,'afk_guard_dg_steel'],
    [461,'afk_guard_dg_magic'],[451,'afk_siege2_def siege_v2_kent_gate'],[320,'afk_siege2_retake siege_v2_kent_tower_guard'],
    [15,'siege_v2_kent_tower'],[77,'afk_riftdg'],[303,'growth_mushroom'],[77,'afk_awq_echo'],
    [440,'petra_baobab'],[780,'petra_oasis petra_dry petra_canyon petra_bandit town_petra'],[781,'petra_nemesis petra_sandhell'],
    [782,'petra_ruins'],[72,'snow_sanctum town_snowwall'],[67,'snow_lava'],[73,'snow_collapse'],
    [522,'afk_solo_belief1'],[523,'afk_solo_belief2'],[524,'afk_solo_belief3'],[530,'afk_solo_belief4'],
    [257,'afk_solo_ruin1'],[258,'afk_solo_ruin2'],[259,'afk_solo_ruin3'],[483,'afk_solo_ruin4'],
    [62,'afk_solo_central'],[450,'afk_raid'],[200,'dom_tower_top'],
  ];
  for(let n=1;n<=10;n++)floors.push([100+n*10,'dom_tower_'+n]);
  function expand(original){
    const areas={...original},centers=new Map();
    for(const a of Object.values(original))if(!centers.has(a.map))centers.set(a.map,a);
    const make=id=>{const area=centers.get(id);if(!area)throw Error('缺少地形來源 '+id);return area;};
    for(const [keys,map,x,y] of regions)for(const key of keys.split(' '))areas[key]={map,x,y};
    // The connected native safety zone reaches 138 tiles from Silent Cavern's village centre.
    areas.town_silent={...areas.town_silent,nativeSafetyRadius:138};
    for(const [id,keys] of floors)for(const key of keys.split(' ')){
      const a=make(id);areas[key]={map:a.map,x:a.x,y:a.y,instance:true};
    }
    // Original interior doors and viable arrival cells on maps whose rectangle centers are void.
    // Iron Gate Guild's castle return point is on map 66 (L1CastleLocation.getCastleLoc).
    const entrances=[[15,32734,32812],[29,32733,32816],[52,32727,32828],[64,32572,32862],[66,32853,32810],[300,32891,32580]];
    for(const [map,x,y] of entrances)for(const [key,a] of Object.entries(areas)){
      if(a.map===map && (key.startsWith('town_')||['kent_inner','ww_inner','heine_inner','giran_inner','dwarf_castle_inner','aden_inner'].includes(key)))
        areas[key]={map,x,y,castleInterior:true};
    }
    for(const [map,x,y] of [[88,33512,32727],[202,32728,32807],[203,32728,32807],[204,32728,32807],[210,32728,32807],[211,32728,32807],[217,32716,32805],[2000,32735,32939]]){
      areas['giran_floor_'+map]={map,x,y};
    }
    const themes={hall:62,cave:308,forest:303,desert:780,ice:73,coast:420,keep:320};
    const scenes={clock:77,hardin:16,ship:551,dragon:37,ember:605,ice:73,altar:471};
    function resolve(key,label){
      if(areas[key])return areas[key];
      const spec=AFK_DIMENSION_VIEW.fieldDefinition(key,label||key);
      const chapter=Object.keys(scenes).find(tag=>key.startsWith('riftdg_'+tag));
      const a=make(scenes[chapter]||themes[spec.theme]||62);
      return {map:a.map,x:a.x,y:a.y,instance:true};
    }
    return {areas,resolve};
  }
  return {expand};
})();
