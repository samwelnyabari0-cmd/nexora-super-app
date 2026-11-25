alter table public.arena_tournaments
 add constraint arena_tournament_game_platform_compatibility check (
  (game_key='efootball' and platform_key in ('mobile','console_pc','cross_platform'))
  or (game_key in ('fc_mobile','pubg_mobile') and platform_key='mobile')
  or (game_key='nexora_minigames' and platform_key='not_applicable')
 ),
 add constraint arena_tournament_game_format_compatibility check (
  (game_key in ('efootball','fc_mobile') and format_key='single_elimination')
  or (game_key='pubg_mobile' and format_key in ('battle_royale_points','single_elimination'))
  or (game_key='nexora_minigames' and format_key in ('mini_game_challenge','single_elimination'))
 );