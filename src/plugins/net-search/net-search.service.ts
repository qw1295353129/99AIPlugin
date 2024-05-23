import { Injectable } from '@nestjs/common';
import { ExecutePluginDto } from '../dto/execute-plugin.dto';
import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

@Injectable()
export class NetSearchService {
  async execute(params: ExecutePluginDto): Promise<string> {
    return compileNetwork(params.prompt);
  }
}

/**
 * 格式化搜索数据，生成结构化的回答。
 * @param searchData 包含搜索结果的对象
 * @param question 用户的查询问题
 * @return 格式化后的回答文本
 */
function formatSearchData(searchData: {
  results: Array<{ href: string; content: string; abstract: string }>;
}): string {
  const formatStr = searchData.results
    .map(
      ({ href, content, abstract }) =>
        `链接: ${href}
        摘要: ${abstract}
        内容: ${content}; `,
    )
    .join('\n\n');
  const instructions = `
  你的任务是根据用户的问题，通过下面的搜索结果提供更精确、详细、具体的回答。回答中，需要在引用处使用 [[序号](链接地址)] 格式标注链接。
  注意回答语言需要与用户提问的语言一致，以下是搜索结果：`;
  return `${instructions}\n${formatStr}`;
}

/**
 * 使用 Puppeteer 在 Bing 中搜索给定查询并抓取前五个搜索结果的链接和内容。
 * @param query 用户的查询字符串
 * @return 返回一个包含搜索结果的对象数组
 */
async function bingSearch(
  query: string,
): Promise<Array<{ href: string; title: string; abstract: string }>> {
  console.log(`开始在Bing中搜索查询: ${query}`);
  const bingUrl = process.env.BING_URL || 'https://cn.bing.com';
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.goto(
    `${bingUrl}/search?form=QBRE&q=${encodeURIComponent(query)}&cc=CN`,
  );
  console.log('已导航到Bing搜索页面');

  const items = await page.evaluate(() => {
    const liElements = Array.from(
      document.querySelectorAll('#b_results > .b_algo'),
    );
    const firstFiveLiElements = liElements.slice(0, 5);
    return firstFiveLiElements.map((li) => {
      const abstractElement = li.querySelector('.b_caption > p');
      const linkElement = li.querySelector('a');
      const href = linkElement ? linkElement.getAttribute('href') || '' : '';
      const title = linkElement ? linkElement.textContent || '' : '';
      const abstract = abstractElement ? abstractElement.textContent || '' : '';
      return { href, title, abstract };
    });
  });

  await browser.close();

  console.log(`解析到的链接数量：${items.length}`);
  items.forEach((item) => {
    console.log(`标题: ${item.title}`);
    console.log(`链接: ${item.href}`);
    console.log(`摘要: ${item.abstract}`);
  });

  return items;
}

/**
 * 使用 Puppeteer 在 Google 中搜索给定查询并抓取前五个搜索结果的链接和内容。
 * @param query 用户的查询字符串
 * @return 返回一个包含搜索结果的对象数组
 */
async function googleSearch(
  query: string,
): Promise<Array<{ href: string; title: string; abstract: string }>> {
  console.log(`开始在Google中搜索查询: ${query}`);
  const googleUrl = process.env.GOOGLE_URL || 'https://www.google.com.hk';
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.goto(
    `${googleUrl}/search?q=${encodeURIComponent(query)}&oq=${encodeURIComponent(query)}&uule=w+CAIQICIaQXVzdGluLFRleGFzLFVuaXRlZCBTdGF0ZXM&hl=en&gl=us&sourceid=chrome&ie=UTF-8%22#ip=1`,
  );
  console.log('已导航到Google搜索页面');

  const items = await page.evaluate(() => {
    const liElements = Array.from(
      (document.querySelector('#search > div > div') as Element).childNodes,
    ) as Element[];
    const firstFiveLiElements = liElements.slice(0, 5);
    return firstFiveLiElements.map((li) => {
      const linkElement = li.querySelector('a');
      const href = linkElement ? linkElement.getAttribute('href') || '' : '';
      const title = linkElement
        ? linkElement.querySelector('a > h3')?.textContent || ''
        : '';
      const abstract = Array.from(
        li.querySelectorAll('div > div > div > div > div > div > span'),
      )
        .map((e) => e.textContent || '')
        .join('');
      return { href, title, abstract };
    });
  });

  await browser.close();

  console.log(`解析到的链接数量：${items.length}`);
  items.forEach((item) => {
    console.log(`标题: ${item.title}`);
    console.log(`链接: ${item.href}`);
    console.log(`摘要: ${item.abstract}`);
  });

  return items;
}

/**
 * 使用 Puppeteer 在 DuckDuckGo 中搜索给定查询并抓取前五个搜索结果的链接和内容。
 * @param query 用户的查询字符串
 * @return 返回一个包含搜索结果的对象数组
 */
async function duckduckgoSearch(
  query: string,
): Promise<Array<{ href: string; title: string; abstract: string }>> {
  console.log(`开始在DuckDuckGo中搜索查询: ${query}`);
  const duckduckgoUrl = process.env.DUCKDUCKGO_URL || 'https://duckduckgo.com';
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.goto(
    `${duckduckgoUrl}/?q=${encodeURIComponent(query)}&kl=hk-tzh&ia=web`,
  );
  console.log('已导航到DuckDuckGo搜索页面');

  const items = await page.evaluate(() => {
    const liElements = Array.from(
      document.querySelectorAll('#react-layout ol li'),
    );
    const firstFiveLiElements = liElements.slice(0, 5);
    return firstFiveLiElements.map((li) => {
      const abstractElement = li.querySelector('div:nth-child(3) > div');
      const linkElement = li.querySelector('div:nth-child(2) > a');
      const href = linkElement ? linkElement.getAttribute('href') || '' : '';
      const title = linkElement ? linkElement.textContent || '' : '';
      const abstract = abstractElement ? abstractElement.textContent || '' : '';
      return { href, title, abstract };
    });
  });

  await browser.close();

  console.log(`解析到的链接数量：${items.length}`);
  items.forEach((item) => {
    console.log(`标题: ${item.title}`);
    console.log(`链接: ${item.href}`);
    console.log(`摘要: ${item.abstract}`);
  });

  return items;
}

/**
 * 使用 souGouSearch 中搜索给定页面的内容。
 * @param query 用户的查询字符串
 * @return 返回一个页面抓取的数据
 */
async function souGouSearch(query: string,): Promise<Array<{ href: string; title: string; abstract: string }>> {
  console.log(`开始在souGou中搜索查询: ${query}`);
  const souGouSearchUrl =  'https://www.sogou.com';
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.goto(
      `${souGouSearchUrl}/sogou?pid=sogou-site-7985672db979303a&query=${encodeURIComponent(query)}`,
  );
  console.log('已导航到souGou搜索页面');

  const items = await page.evaluate(() => {
    const liElements = Array.from(
        document.querySelectorAll('#react-layout ol li'),
    );
    const firstFiveLiElements = liElements.slice(0, 5);
    return firstFiveLiElements.map((li) => {
      const abstractElement = li.querySelector('div:nth-child(3) > div');
      const linkElement = li.querySelector('div:nth-child(2) > a');
      const href = linkElement ? linkElement.getAttribute('href') || '' : '';
      const title = linkElement ? linkElement.textContent || '' : '';
      const abstract = abstractElement ? abstractElement.textContent || '' : '';
      return { href, title, abstract };
    });
  });

  await browser.close();

  console.log(`解析到的链接数量：${items.length}`);
  items.forEach((item) => {
    console.log(`标题: ${item.title}`);
    console.log(`链接: ${item.href}`);
    console.log(`摘要: ${item.abstract}`);
  });

  return items;
}

/**
 * 打开链接并获取内容。
 * @param href 链接地址
 * @return 包含链接内容的字符串
 */
async function fetchContent(href: string): Promise<string> {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  let content = '无法获取内容';
  try {
    await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 60000 }); // 设置超时为60秒
    content = await page.evaluate(() => {
      const bodyText = document.body.innerText.trim();
      return bodyText.length > 0 ? bodyText : '无内容';
    });
    content = content.length > 1000 ? content.slice(0, 1000) + '...' : content;
  } catch (error) {
    console.error(`访问链接 ${href} 失败，使用默认内容：${error}`);
  } finally {
    await page.close();
    await browser.close();
  }
  return content;
}

/**
 * 编译网络请求，处理用户问题，并返回格式化的搜索结果。
 * @param question 用户的查询问题
 * @return 格式化的搜索结果或原始问题
 */
export async function compileNetwork(question: string): Promise<string> {
  console.log(`开始对问题“${question}”进行网络搜索`);
  const enableQuickSearch = process.env.ENABLE_QUICK_SEARCH === 'true';
  console.log(`快速搜索功能是否启用：${enableQuickSearch}`);
  let searchData;
  try {
    try {
      const weatherResults = await textjson(question);
      if (weatherResults) {
        console.log('检测到天气搜索...');
        const weatherSearchResults = await weatherSearch(weatherResults);
        const instructions = `
      你的任务是根据用户的问题，通过下面的搜索结果提供更精确、详细、具体的回答。回答中，
      注意回答语言需要与用户提问的语言一致，以下是搜索结果：`;
        const finalInstructions = `${instructions}\n${weatherSearchResults}`;
        return finalInstructions;
      }
    }catch (error) {
    }

    let results = await bingSearch(question);
    if (results.length < 3) {
      console.log('Bing搜索结果不足，尝试从souGou搜索...');
      const souGouResults = await souGouSearch(question);
      results = results.concat(souGouResults);
    }
    if (results.length < 3) {
      console.log('souGou搜索结果不足，尝试从DuckDuckGo搜索...');
      const duckduckgoResults = await duckduckgoSearch(question);
      results = results.concat(duckduckgoResults);
    }
    if (results.length < 3) {
      console.log('DuckDuckGo搜索结果不足，尝试从Google搜索...');
      const googleResults = await googleSearch(question);
      results = results.concat(googleResults);
    }

    if (enableQuickSearch) {
      searchData = {
        results: results.map((item) => ({
          ...item,
          content: '',
        })),
      };
    } else {
      searchData = {
        results: await Promise.all(
          results.map(async (item) => {
            const content = await fetchContent(item.href);
            return { ...item, content };
          }),
        ),
      };
    }

    console.log(
      `已成功接收到“${question}”的搜索结果，结果数量为：${searchData.results.length}`,
    );
  } catch (error) {
    console.error(`处理问题“${question}”时出现错误：`, error);
    return question;
  }

  if (searchData.results.length === 0) {
    console.log(`未找到问题“${question}”的搜索结果，将返回原问题`);
    return question;
  } else {
    const formattedData = formatSearchData(searchData);
    return formattedData;
  }
}

function textjson(targetStr: string): string {
  if (!targetStr.includes("天气")) {
    return null;
  }
  const cities = [{"北京":"101010100"},{"朝阳":"101010300"},{"顺义":"101010400"},{"怀柔":"101010500"},{"通州":"101010600"},{"昌平":"101010700"},{"延庆":"101010800"},{"丰台":"101010900"},{"石景山":"101011000"},{"大兴":"101011100"},{"房山":"101011200"},{"密云":"101011300"},{"门头沟":"101011400"},{"平谷":"101011500"},{"八达岭":"101011600"},{"佛爷顶":"101011700"},{"汤河口":"101011800"},{"密云上甸子":"101011900"},{"斋堂":"101012000"},{"霞云岭":"101012100"},{"北京城区":"101012200"},{"海淀":"101010200"},{"天津":"101030100"},{"宝坻":"101030300"},{"东丽":"101030400"},{"西青":"101030500"},{"北辰":"101030600"},{"蓟县":"101031400"},{"汉沽":"101030800"},{"静海":"101030900"},{"津南":"101031000"},{"塘沽":"101031100"},{"大港":"101031200"},{"武清":"101030200"},{"宁河":"101030700"},{"上海":"101020100"},{"宝山":"101020300"},{"嘉定":"101020500"},{"南汇":"101020600"},{"浦东":"101021300"},{"青浦":"101020800"},{"松江":"101020900"},{"奉贤":"101021000"},{"崇明":"101021100"},{"徐家汇":"101021200"},{"闵行":"101020200"},{"金山":"101020700"},{"石家庄":"101090101"},{"张家口":"101090301"},{"承德":"101090402"},{"唐山":"101090501"},{"秦皇岛":"101091101"},{"沧州":"101090701"},{"衡水":"101090801"},{"邢台":"101090901"},{"邯郸":"101091001"},{"保定":"101090201"},{"廊坊":"101090601"},{"郑州":"101180101"},{"新乡":"101180301"},{"许昌":"101180401"},{"平顶山":"101180501"},{"信阳":"101180601"},{"南阳":"101180701"},{"开封":"101180801"},{"洛阳":"101180901"},{"商丘":"101181001"},{"焦作":"101181101"},{"鹤壁":"101181201"},{"濮阳":"101181301"},{"周口":"101181401"},{"漯河":"101181501"},{"驻马店":"101181601"},{"三门峡":"101181701"},{"济源":"101181801"},{"安阳":"101180201"},{"合肥":"101220101"},{"芜湖":"101220301"},{"淮南":"101220401"},{"马鞍山":"101220501"},{"安庆":"101220601"},{"宿州":"101220701"},{"阜阳":"101220801"},{"亳州":"101220901"},{"黄山":"101221001"},{"滁州":"101221101"},{"淮北":"101221201"},{"铜陵":"101221301"},{"宣城":"101221401"},{"六安":"101221501"},{"巢湖":"101221601"},{"池州":"101221701"},{"蚌埠":"101220201"},{"杭州":"101210101"},{"舟山":"101211101"},{"湖州":"101210201"},{"嘉兴":"101210301"},{"金华":"101210901"},{"绍兴":"101210501"},{"台州":"101210601"},{"温州":"101210701"},{"丽水":"101210801"},{"衢州":"101211001"},{"宁波":"101210401"},{"重庆":"101040100"},{"合川":"101040300"},{"南川":"101040400"},{"江津":"101040500"},{"万盛":"101040600"},{"渝北":"101040700"},{"北碚":"101040800"},{"巴南":"101040900"},{"长寿":"101041000"},{"黔江":"101041100"},{"万州天城":"101041200"},{"万州龙宝":"101041300"},{"涪陵":"101041400"},{"开县":"101041500"},{"城口":"101041600"},{"云阳":"101041700"},{"巫溪":"101041800"},{"奉节":"101041900"},{"巫山":"101042000"},{"潼南":"101042100"},{"垫江":"101042200"},{"梁平":"101042300"},{"忠县":"101042400"},{"石柱":"101042500"},{"大足":"101042600"},{"荣昌":"101042700"},{"铜梁":"101042800"},{"璧山":"101042900"},{"丰都":"101043000"},{"武隆":"101043100"},{"彭水":"101043200"},{"綦江":"101043300"},{"酉阳":"101043400"},{"秀山":"101043600"},{"沙坪坝":"101043700"},{"永川":"101040200"},{"福州":"101230101"},{"泉州":"101230501"},{"漳州":"101230601"},{"龙岩":"101230701"},{"晋江":"101230509"},{"南平":"101230901"},{"厦门":"101230201"},{"宁德":"101230301"},{"莆田":"101230401"},{"三明":"101230801"},{"兰州":"101160101"},{"平凉":"101160301"},{"庆阳":"101160401"},{"武威":"101160501"},{"金昌":"101160601"},{"嘉峪关":"101161401"},{"酒泉":"101160801"},{"天水":"101160901"},{"武都":"101161001"},{"临夏":"101161101"},{"合作":"101161201"},{"白银":"101161301"},{"定西":"101160201"},{"张掖":"101160701"},{"广州":"101280101"},{"惠州":"101280301"},{"梅州":"101280401"},{"汕头":"101280501"},{"深圳":"101280601"},{"珠海":"101280701"},{"佛山":"101280800"},{"肇庆":"101280901"},{"湛江":"101281001"},{"江门":"101281101"},{"河源":"101281201"},{"清远":"101281301"},{"云浮":"101281401"},{"潮州":"101281501"},{"东莞":"101281601"},{"中山":"101281701"},{"阳江":"101281801"},{"揭阳":"101281901"},{"茂名":"101282001"},{"汕尾":"101282101"},{"韶关":"101280201"},{"南宁":"101300101"},{"柳州":"101300301"},{"来宾":"101300401"},{"桂林":"101300501"},{"梧州":"101300601"},{"防城港":"101301401"},{"贵港":"101300801"},{"玉林":"101300901"},{"百色":"101301001"},{"钦州":"101301101"},{"河池":"101301201"},{"北海":"101301301"},{"崇左":"101300201"},{"贺州":"101300701"},{"贵阳":"101260101"},{"安顺":"101260301"},{"都匀":"101260401"},{"兴义":"101260906"},{"铜仁":"101260601"},{"毕节":"101260701"},{"六盘水":"101260801"},{"遵义":"101260201"},{"凯里":"101260501"},{"昆明":"101290101"},{"红河":"101290301"},{"文山":"101290601"},{"玉溪":"101290701"},{"楚雄":"101290801"},{"普洱":"101290901"},{"昭通":"101291001"},{"临沧":"101291101"},{"怒江":"101291201"},{"香格里拉":"101291301"},{"丽江":"101291401"},{"德宏":"101291501"},{"景洪":"101291601"},{"大理":"101290201"},{"曲靖":"101290401"},{"保山":"101290501"},{"呼和浩特":"101080101"},{"乌海":"101080301"},{"集宁":"101080401"},{"通辽":"101080501"},{"阿拉善左旗":"101081201"},{"鄂尔多斯":"101080701"},{"临河":"101080801"},{"锡林浩特":"101080901"},{"呼伦贝尔":"101081000"},{"乌兰浩特":"101081101"},{"包头":"101080201"},{"赤峰":"101080601"},{"南昌":"101240101"},{"上饶":"101240301"},{"抚州":"101240401"},{"宜春":"101240501"},{"鹰潭":"101241101"},{"赣州":"101240701"},{"景德镇":"101240801"},{"萍乡":"101240901"},{"新余":"101241001"},{"九江":"101240201"},{"吉安":"101240601"},{"武汉":"101200101"},{"黄冈":"101200501"},{"荆州":"101200801"},{"宜昌":"101200901"},{"恩施":"101201001"},{"十堰":"101201101"},{"神农架":"101201201"},{"随州":"101201301"},{"荆门":"101201401"},{"天门":"101201501"},{"仙桃":"101201601"},{"潜江":"101201701"},{"襄樊":"101200201"},{"鄂州":"101200301"},{"孝感":"101200401"},{"黄石":"101200601"},{"咸宁":"101200701"},{"成都":"101270101"},{"自贡":"101270301"},{"绵阳":"101270401"},{"南充":"101270501"},{"达州":"101270601"},{"遂宁":"101270701"},{"广安":"101270801"},{"巴中":"101270901"},{"泸州":"101271001"},{"宜宾":"101271101"},{"内江":"101271201"},{"资阳":"101271301"},{"乐山":"101271401"},{"眉山":"101271501"},{"凉山":"101271601"},{"雅安":"101271701"},{"甘孜":"101271801"},{"阿坝":"101271901"},{"德阳":"101272001"},{"广元":"101272101"},{"攀枝花":"101270201"},{"银川":"101170101"},{"中卫":"101170501"},{"固原":"101170401"},{"石嘴山":"101170201"},{"吴忠":"101170301"},{"西宁":"101150101"},{"黄南":"101150301"},{"海北":"101150801"},{"果洛":"101150501"},{"玉树":"101150601"},{"海西":"101150701"},{"海东":"101150201"},{"海南":"101150401"},{"济南":"101120101"},{"潍坊":"101120601"},{"临沂":"101120901"},{"菏泽":"101121001"},{"滨州":"101121101"},{"东营":"101121201"},{"威海":"101121301"},{"枣庄":"101121401"},{"日照":"101121501"},{"莱芜":"101121601"},{"聊城":"101121701"},{"青岛":"101120201"},{"淄博":"101120301"},{"德州":"101120401"},{"烟台":"101120501"},{"济宁":"101120701"},{"泰安":"101120801"},{"西安":"101110101"},{"延安":"101110300"},{"榆林":"101110401"},{"铜川":"101111001"},{"商洛":"101110601"},{"安康":"101110701"},{"汉中":"101110801"},{"宝鸡":"101110901"},{"咸阳":"101110200"},{"渭南":"101110501"},{"太原":"101100101"},{"临汾":"101100701"},{"运城":"101100801"},{"朔州":"101100901"},{"忻州":"101101001"},{"长治":"101100501"},{"大同":"101100201"},{"阳泉":"101100301"},{"晋中":"101100401"},{"晋城":"101100601"},{"吕梁":"101101100"},{"乌鲁木齐":"101130101"},{"石河子":"101130301"},{"昌吉":"101130401"},{"吐鲁番":"101130501"},{"库尔勒":"101130601"},{"阿拉尔":"101130701"},{"阿克苏":"101130801"},{"喀什":"101130901"},{"伊宁":"101131001"},{"塔城":"101131101"},{"哈密":"101131201"},{"和田":"101131301"},{"阿勒泰":"101131401"},{"阿图什":"101131501"},{"博乐":"101131601"},{"克拉玛依":"101130201"},{"拉萨":"101140101"},{"山南":"101140301"},{"阿里":"101140701"},{"昌都":"101140501"},{"那曲":"101140601"},{"日喀则":"101140201"},{"林芝":"101140401"},{"台北县":"101340101"},{"高雄":"101340201"},{"台中":"101340401"},{"海口":"101310101"},{"三亚":"101310201"},{"东方":"101310202"},{"临高":"101310203"},{"澄迈":"101310204"},{"儋州":"101310205"},{"昌江":"101310206"},{"白沙":"101310207"},{"琼中":"101310208"},{"定安":"101310209"},{"屯昌":"101310210"},{"琼海":"101310211"},{"文昌":"101310212"},{"保亭":"101310214"},{"万宁":"101310215"},{"陵水":"101310216"},{"西沙":"101310217"},{"南沙岛":"101310220"},{"乐东":"101310221"},{"五指山":"101310222"},{"琼山":"101310102"},{"长沙":"101250101"},{"株洲":"101250301"},{"衡阳":"101250401"},{"郴州":"101250501"},{"常德":"101250601"},{"益阳":"101250700"},{"娄底":"101250801"},{"邵阳":"101250901"},{"岳阳":"101251001"},{"张家界":"101251101"},{"怀化":"101251201"},{"黔阳":"101251301"},{"永州":"101251401"},{"吉首":"101251501"},{"湘潭":"101250201"},{"南京":"101190101"},{"镇江":"101190301"},{"苏州":"101190401"},{"南通":"101190501"},{"扬州":"101190601"},{"宿迁":"101191301"},{"徐州":"101190801"},{"淮安":"101190901"},{"连云港":"101191001"},{"常州":"101191101"},{"泰州":"101191201"},{"无锡":"101190201"},{"盐城":"101190701"},{"哈尔滨":"101050101"},{"牡丹江":"101050301"},{"佳木斯":"101050401"},{"绥化":"101050501"},{"黑河":"101050601"},{"双鸭山":"101051301"},{"伊春":"101050801"},{"大庆":"101050901"},{"七台河":"101051002"},{"鸡西":"101051101"},{"鹤岗":"101051201"},{"齐齐哈尔":"101050201"},{"大兴安岭":"101050701"},{"长春":"101060101"},{"延吉":"101060301"},{"四平":"101060401"},{"白山":"101060901"},{"白城":"101060601"},{"辽源":"101060701"},{"松原":"101060801"},{"吉林":"101060201"},{"通化":"101060501"},{"沈阳":"101070101"},{"鞍山":"101070301"},{"抚顺":"101070401"},{"本溪":"101070501"},{"丹东":"101070601"},{"葫芦岛":"101071401"},{"营口":"101070801"},{"阜新":"101070901"},{"辽阳":"101071001"},{"铁岭":"101071101"},{"朝阳":"101071201"},{"盘锦":"101071301"},{"大连":"101070201"},{"锦州":"101070701"}];
  function findKeyValue(arr: Array<{ [key: string]: string }>, targetStr: string): { key: string, value: string } | null {
    for (const obj of arr) {
      const key = Object.keys(obj)[0];
      if (targetStr.includes(key)) {
        return { key, value: obj[key] };
      }
    }
    return null;
  }

  const result = findKeyValue(cities, targetStr);
  if (result) {
    // console.log(`字符串包含key: ${result.key}, 对应的value是: ${result.value}`);
    return result.value;
  } else {
    // console.log("字符串不包含任何key");
    return null;
  }
}

/**
 * 每次请求间隔必须3秒一次，如果多次超过3秒内调用多次，会封掉IP段
 * 每分钟阈值为300次，如果超过会禁用3600秒。请谨慎使用
 * 使用 天气搜索。
 * @param query 用户的查询字符串
 * @return 返回天气搜索的数据
 */
async function weatherSearch(query: string,): Promise<Array<{ href: string; title: string; abstract: string }>> {
  console.log(`开始天气搜索查询: ${query}`);
  const baseSearchUrl =  'http://t.weather.itboy.net';
  try {
    const response = await axios.get(`${baseSearchUrl}/api/weather/city/${query}`);
    const jsonResponse = response.data;

    if (!jsonResponse.data || !jsonResponse.data.forecast) {
      throw new Error('Invalid response format');
    }

    const forecast = jsonResponse.data.forecast;
    const parsedForecasts = forecast.map((item: any) => {
      return `日期: ${item.date}, 高温: ${item.high}, 低温: ${item.low}, ` +
          `日期: ${item.ymd}, 星期: ${item.week}, 日出: ${item.sunrise}, ` +
          `日落: ${item.sunset}, 空气质量指数: ${item.aqi}, 风向: ${item.fx}, ` +
          `风力: ${item.fl}, 天气类型: ${item.type}, 提示: ${item.notice}`;
    }).join(' ');

    return parsedForecasts;
  } catch (error) {
    console.error('Error fetching weather data:', error);
  }
}