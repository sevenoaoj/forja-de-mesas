export function database(query, assets) {
  return {
    ...assets,
    async get(id) {
      const row = await query.first('SELECT * FROM campaigns WHERE id = ?', [id]);
      return row ? {...row,state:JSON.parse(row.state)} : null;
    },
    async create(row) {
      await query.run('INSERT INTO campaigns (id,owner,player,rev,state) VALUES (?,?,?,?,?)',
        [row.id,row.owner,row.player,row.rev,JSON.stringify(row.state)]);
    },
    async remove(row) {return (await query.run('DELETE FROM campaigns WHERE id = ? AND rev = ?',[row.id,row.rev]))===1;},
    async save(row) {
      const state = JSON.stringify(row.state);
      if (new TextEncoder().encode(state).length > (row.state.sceneLibrary?8_000_000:1_500_000)) {
        throw Object.assign(new Error('Limite de dados da campanha atingido.'),{status:413});
      }
      return (await query.run('UPDATE campaigns SET state = ?, rev = rev + 1 WHERE id = ? AND rev = ?',
        [state,row.id,row.rev])) === 1;
    }
  };
}
